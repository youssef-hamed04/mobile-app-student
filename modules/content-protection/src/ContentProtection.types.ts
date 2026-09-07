import type { ViewProps } from 'react-native';

export interface ContentProtectionCapabilities {
  isSupported: boolean;
  platform: 'ios' | 'android' | 'unsupported';
  /** Android: window FLAG_SECURE. iOS reports false — it uses a secure surface. */
  supportsSecureFlag: boolean;
  /** A screenshot event can be observed. */
  supportsCaptureDetection: boolean;
  /** Live "is the screen being recorded" state can be observed. */
  supportsRecordingDetection: boolean;
  /** A capture-excluded rendering surface is available. */
  supportsSecureSurface: boolean;
  sdkInt?: number;
  systemVersion?: string;
}

export interface IntegritySignals {
  rooted: boolean;
  debuggerAttached: boolean;
  emulator: boolean;
  developerModeOn: boolean;
  adbEnabled: boolean;
}

export interface ScreenCapturedEvent {
  /** Epoch ms. */
  at: number;
}

export interface ScreenRecordingEvent {
  recording: boolean;
}

export interface ExternalDisplayEvent {
  external: boolean;
}

export interface ContentProtectionEvents {
  onScreenCaptured: (e: ScreenCapturedEvent) => void;
  onScreenRecordingChanged: (e: ScreenRecordingEvent) => void;
  onExternalDisplayChanged: (e: ExternalDisplayEvent) => void;
}

export interface SecureContentViewProps extends ViewProps {
  /**
   * When true the children are rendered into a capture-excluded surface.
   * Defaults to true; set false only for non-protected content.
   */
  enabled?: boolean;
  children?: React.ReactNode;
}

export type ProtectionPosture =
  /** Full platform protection is active. */
  | 'protected'
  /** Running without native protection (Expo Go / web). Playback is refused. */
  | 'unavailable'
  /** Protection active but a capture is currently in progress. */
  | 'compromised';
