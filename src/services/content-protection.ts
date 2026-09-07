import {
  addExternalDisplayListener,
  addScreenCaptureListener,
  addScreenRecordingListener,
  capabilities,
  getIntegritySignals,
  hasExternalDisplay,
  isBeingRecorded,
  setSecureFlag,
  startDetection,
  stopDetection,
} from '@modules/content-protection';
import type { EventSubscription } from 'expo-modules-core';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { isDev } from '@/config/env';

import { createLogger } from './logger';

const log = createLogger('protection');

export type ProtectionThreat =
  | 'SCREENSHOT'
  | 'RECORDING_STARTED'
  | 'RECORDING_STOPPED'
  | 'EXTERNAL_DISPLAY'
  | 'INTEGRITY';

export interface ProtectionState {
  /** Native protection is present and active. */
  available: boolean;
  /** A recording / mirroring session is in progress right now. */
  recording: boolean;
  /** A non-secure external display is attached. */
  externalDisplay: boolean;
  /** Number of screenshot attempts observed this app session. */
  captureAttempts: number;
  /** Device integrity looks compromised. */
  integrityFailed: boolean;
}

type Listener = (state: ProtectionState, threat?: ProtectionThreat) => void;

/**
 * Process-wide protection controller.
 *
 * Owns the native subscriptions (there is exactly one set, not one per
 * screen), keeps a reference count of protected screens so FLAG_SECURE is
 * only relaxed when the last one unmounts, and reports every threat event to
 * the backend so the audit trail lives server-side where it can't be stripped.
 */
class ContentProtectionController {
  private state: ProtectionState = {
    available: capabilities.isSupported,
    recording: false,
    externalDisplay: false,
    captureAttempts: 0,
    integrityFailed: false,
  };

  private listeners = new Set<Listener>();
  private subs: EventSubscription[] = [];
  private protectedScreens = 0;
  private started = false;
  /** Context of the currently protected screen, sent with security events. */
  private context: { videoId?: string; courseId?: string; lessonId?: string } = {};

  getState(): ProtectionState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(threat?: ProtectionThreat) {
    for (const fn of this.listeners) {
      try {
        fn(this.state, threat);
      } catch (e) {
        log.error('protection listener threw', { e: String(e) });
      }
    }
  }

  private patch(partial: Partial<ProtectionState>, threat?: ProtectionThreat) {
    this.state = { ...this.state, ...partial };
    this.emit(threat);
  }

  /** Called once at app start. */
  async initialize() {
    if (this.started) return;
    this.started = true;

    if (!capabilities.isSupported) {
      log.warn(
        'native content protection unavailable — protected playback will be refused',
        { capabilities }
      );
      this.patch({ available: false });
      return;
    }

    const signals = getIntegritySignals();
    const integrityFailed =
      !isDev && (signals.rooted || signals.debuggerAttached || signals.emulator);

    await startDetection();

    this.subs = [
      addScreenCaptureListener(() => {
        this.patch(
          { captureAttempts: this.state.captureAttempts + 1 },
          'SCREENSHOT'
        );
        void this.report('SCREENSHOT');
      }),

      addScreenRecordingListener(({ recording }) => {
        this.patch({ recording }, recording ? 'RECORDING_STARTED' : 'RECORDING_STOPPED');
        void this.report(recording ? 'RECORDING_STARTED' : 'RECORDING_STOPPED');
      }),

      addExternalDisplayListener(({ external }) => {
        this.patch({ externalDisplay: external }, 'EXTERNAL_DISPLAY');
        if (external) void this.report('EXTERNAL_DISPLAY');
      }),
    ];

    this.patch({
      available: true,
      recording: isBeingRecorded(),
      externalDisplay: hasExternalDisplay(),
      integrityFailed,
    });

    if (integrityFailed) {
      log.warn('device integrity signals failed', signals);
      void this.report('INTEGRITY', signals);
    }
  }

  async shutdown() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    await stopDetection();
    this.started = false;
  }

  /**
   * Called by every protected screen on mount. Returns a release function.
   * Reference counted so nested protected surfaces behave correctly.
   */
  async acquire(context: typeof this.context = {}) {
    this.context = { ...this.context, ...context };
    this.protectedScreens += 1;
    if (this.protectedScreens === 1) {
      await setSecureFlag(true);
    }
    return () => void this.release();
  }

  private async release() {
    this.protectedScreens = Math.max(0, this.protectedScreens - 1);
    if (this.protectedScreens === 0) {
      this.context = {};
      // FLAG_SECURE is deliberately left ON app-wide. Course titles, the
      // student's own name and the watermark preview all count as sensitive,
      // and toggling the flag causes a visible surface re-creation on some
      // Android OEM skins. There is no UX cost to keeping it on.
    }
  }

  /** True when protected media may be shown right now. */
  canPlayProtectedContent(): boolean {
    const s = this.state;
    return s.available && !s.recording && !s.externalDisplay && !s.integrityFailed;
  }

  /** Why playback is blocked, for the UI to render the right message. */
  blockReason(): 'unavailable' | 'recording' | 'external-display' | 'integrity' | null {
    const s = this.state;
    if (!s.available) return 'unavailable';
    if (s.integrityFailed) return 'integrity';
    if (s.recording) return 'recording';
    if (s.externalDisplay) return 'external-display';
    return null;
  }

  /**
   * Fire-and-forget audit report. Never blocks the UI and never throws:
   * a failed report must not become a way to keep watching.
   */
  private async report(threat: ProtectionThreat, meta?: object) {
    try {
      await api.post(
        Endpoints.playback.securityEvent,
        {
          threat,
          ...this.context,
          meta,
          occurredAt: new Date().toISOString(),
        },
        { retries: 0, timeoutMs: 5000 }
      );
    } catch (e) {
      log.warn('security event report failed', { threat, e: String(e) });
    }
  }
}

export const contentProtection = new ContentProtectionController();
export { capabilities as protectionCapabilities };
