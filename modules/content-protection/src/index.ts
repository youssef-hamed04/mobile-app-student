import { NativeModulesProxy, requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';
import * as React from 'react';
import { Platform, View } from 'react-native';

import type {
  ContentProtectionCapabilities,
  ExternalDisplayEvent,
  IntegritySignals,
  ScreenCapturedEvent,
  ScreenRecordingEvent,
  SecureContentViewProps,
} from './ContentProtection.types';

export * from './ContentProtection.types';

interface NativeContentProtection {
  isSupported: boolean;
  platform: 'ios' | 'android';
  supportsSecureFlag: boolean;
  supportsCaptureDetection: boolean;
  supportsRecordingDetection: boolean;
  supportsSecureSurface: boolean;
  sdkInt?: number;
  systemVersion?: string;

  setSecureFlag(enabled: boolean): Promise<boolean>;
  isSecureFlagEnabled(): boolean;
  startDetection(): Promise<void>;
  stopDetection(): Promise<void>;
  isBeingRecorded(): boolean;
  hasExternalDisplay(): boolean;
  getIntegritySignals(): IntegritySignals;

  addListener(
    event: 'onScreenCaptured',
    listener: (e: ScreenCapturedEvent) => void
  ): EventSubscription;
  addListener(
    event: 'onScreenRecordingChanged',
    listener: (e: ScreenRecordingEvent) => void
  ): EventSubscription;
  addListener(
    event: 'onExternalDisplayChanged',
    listener: (e: ExternalDisplayEvent) => void
  ): EventSubscription;
}

/**
 * The native module is absent in Expo Go and on web. We resolve it lazily and
 * degrade to a null object so the app still *runs* — but `capabilities
 * .isSupported` is false, and the video feature treats that as a hard block
 * on protected playback rather than silently streaming unprotected content.
 */
let native: NativeContentProtection | null = null;

function resolveNative(): NativeContentProtection | null {
  if (native) return native;
  if (Platform.OS === 'web') return null;
  try {
    native = requireNativeModule<NativeContentProtection>('ContentProtection');
  } catch {
    native =
      (NativeModulesProxy.ContentProtection as NativeContentProtection | undefined) ??
      null;
  }
  return native;
}

const noopSubscription: EventSubscription = { remove() {} } as EventSubscription;

export const capabilities: ContentProtectionCapabilities = (() => {
  const m = resolveNative();
  if (!m) {
    return {
      isSupported: false,
      platform: 'unsupported',
      supportsSecureFlag: false,
      supportsCaptureDetection: false,
      supportsRecordingDetection: false,
      supportsSecureSurface: false,
    };
  }
  return {
    isSupported: m.isSupported,
    platform: m.platform,
    supportsSecureFlag: m.supportsSecureFlag,
    supportsCaptureDetection: m.supportsCaptureDetection,
    supportsRecordingDetection: m.supportsRecordingDetection,
    supportsSecureSurface: m.supportsSecureSurface,
    sdkInt: m.sdkInt,
    systemVersion: m.systemVersion,
  };
})();

export async function setSecureFlag(enabled: boolean): Promise<boolean> {
  const m = resolveNative();
  if (!m) return false;
  try {
    return await m.setSecureFlag(enabled);
  } catch {
    return false;
  }
}

export function isSecureFlagEnabled(): boolean {
  return resolveNative()?.isSecureFlagEnabled() ?? false;
}

export async function startDetection(): Promise<void> {
  await resolveNative()?.startDetection();
}

export async function stopDetection(): Promise<void> {
  await resolveNative()?.stopDetection();
}

export function isBeingRecorded(): boolean {
  return resolveNative()?.isBeingRecorded() ?? false;
}

export function hasExternalDisplay(): boolean {
  return resolveNative()?.hasExternalDisplay() ?? false;
}

export function getIntegritySignals(): IntegritySignals {
  return (
    resolveNative()?.getIntegritySignals() ?? {
      rooted: false,
      debuggerAttached: false,
      emulator: false,
      developerModeOn: false,
      adbEnabled: false,
    }
  );
}

export function addScreenCaptureListener(
  listener: (e: ScreenCapturedEvent) => void
): EventSubscription {
  return resolveNative()?.addListener('onScreenCaptured', listener) ?? noopSubscription;
}

export function addScreenRecordingListener(
  listener: (e: ScreenRecordingEvent) => void
): EventSubscription {
  return (
    resolveNative()?.addListener('onScreenRecordingChanged', listener) ??
    noopSubscription
  );
}

export function addExternalDisplayListener(
  listener: (e: ExternalDisplayEvent) => void
): EventSubscription {
  return (
    resolveNative()?.addListener('onExternalDisplayChanged', listener) ??
    noopSubscription
  );
}

// ---------------------------------------------------------------------------
// Secure rendering surface
// ---------------------------------------------------------------------------

const NativeSecureView = (() => {
  if (Platform.OS === 'web') return null;
  try {
    return requireNativeViewManager<SecureContentViewProps>('ContentProtection');
  } catch {
    return null;
  }
})();

/**
 * Renders children inside a capture-excluded surface where the platform
 * supports it, and as a plain View otherwise. Callers must check
 * `capabilities.supportsSecureSurface` before deciding to show protected
 * media — this component never pretends to be secure when it isn't.
 */
export const SecureContentView: React.FC<SecureContentViewProps> = ({
  enabled = true,
  children,
  ...rest
}) => {
  if (!NativeSecureView) {
    return React.createElement(View, rest, children);
  }
  return React.createElement(
    NativeSecureView,
    { enabled, ...rest } as SecureContentViewProps,
    children
  );
};

export default {
  capabilities,
  setSecureFlag,
  isSecureFlagEnabled,
  startDetection,
  stopDetection,
  isBeingRecorded,
  hasExternalDisplay,
  getIntegritySignals,
  addScreenCaptureListener,
  addScreenRecordingListener,
  addExternalDisplayListener,
  SecureContentView,
};
