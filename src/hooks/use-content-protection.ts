import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  contentProtection,
  type ProtectionState,
  type ProtectionThreat,
} from '@/services/content-protection';
import { useUIStore } from '@/store/ui-store';

/** Live protection state. Re-renders whenever a threat state changes. */
export function useProtectionState(): ProtectionState {
  const [state, setState] = useState<ProtectionState>(() =>
    contentProtection.getState()
  );

  useEffect(() => contentProtection.subscribe(setState), []);

  return state;
}

export interface ProtectedScreenOptions {
  /** Skip acquisition (e.g. a preview lesson that isn't protected). */
  enabled?: boolean;
  videoId?: string;
  courseId?: string;
  lessonId?: string;
  /** Called when a capture/recording threat occurs while this screen is up. */
  onThreat?: (threat: ProtectionThreat, state: ProtectionState) => void;
  /**
   * Blank the screen while the app is backgrounded. On by default for
   * protected screens so the app-switcher card never shows lesson content.
   */
  shieldOnBackground?: boolean;
}

/**
 * Marks the current screen as protected:
 *  - turns on the platform secure flag / surface for as long as it is mounted
 *  - raises the privacy shield when the app is backgrounded
 *  - raises the privacy shield and notifies the caller on a capture attempt
 */
export function useProtectedScreen(options: ProtectedScreenOptions = {}) {
  const {
    enabled = true,
    videoId,
    courseId,
    lessonId,
    onThreat,
    shieldOnBackground = true,
  } = options;

  const setPrivacyShield = useUIStore((s) => s.setPrivacyShield);
  const state = useProtectionState();

  // --- acquire / release the secure surface ------------------------------
  useEffect(() => {
    if (!enabled) return;
    let release: (() => void) | undefined;
    let cancelled = false;

    void contentProtection.acquire({ videoId, courseId, lessonId }).then((fn) => {
      if (cancelled) fn();
      else release = fn;
    });

    return () => {
      cancelled = true;
      release?.();
    };
  }, [enabled, videoId, courseId, lessonId]);

  // --- background shield --------------------------------------------------
  useEffect(() => {
    if (!enabled || !shieldOnBackground) return;

    const onChange = (status: AppStateStatus) => {
      setPrivacyShield(status !== 'active', 'background');
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      setPrivacyShield(false);
    };
  }, [enabled, shieldOnBackground, setPrivacyShield]);

  // --- threat reaction ----------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    return contentProtection.subscribe((next, threat) => {
      if (!threat) return;

      if (threat === 'SCREENSHOT') {
        setPrivacyShield(true, 'capture');
        // Brief shield: the screenshot has already been blanked by the
        // platform; this makes the block visible to the student.
        setTimeout(() => setPrivacyShield(false), 1200);
      }

      if (threat === 'RECORDING_STARTED') setPrivacyShield(true, 'recording');
      if (threat === 'RECORDING_STOPPED') setPrivacyShield(false);

      onThreat?.(threat, next);
    });
  }, [enabled, onThreat, setPrivacyShield]);

  return {
    state,
    canPlay: contentProtection.canPlayProtectedContent(),
    blockReason: contentProtection.blockReason(),
  };
}
