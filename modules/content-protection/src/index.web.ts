import * as React from 'react';
import { View } from 'react-native';

import type {
  ContentProtectionCapabilities,
  IntegritySignals,
  SecureContentViewProps,
} from './ContentProtection.types';

export * from './ContentProtection.types';

/**
 * Web / test stub. Nothing here is protective — `isSupported: false` is the
 * contract that tells the app to refuse protected playback.
 */
export const capabilities: ContentProtectionCapabilities = {
  isSupported: false,
  platform: 'unsupported',
  supportsSecureFlag: false,
  supportsCaptureDetection: false,
  supportsRecordingDetection: false,
  supportsSecureSurface: false,
};

const noSub = { remove() {} };

export const setSecureFlag = async () => false;
export const isSecureFlagEnabled = () => false;
export const startDetection = async () => undefined;
export const stopDetection = async () => undefined;
export const isBeingRecorded = () => false;
export const hasExternalDisplay = () => false;
export const getIntegritySignals = (): IntegritySignals => ({
  rooted: false,
  debuggerAttached: false,
  emulator: false,
  developerModeOn: false,
  adbEnabled: false,
});
export const addScreenCaptureListener = () => noSub;
export const addScreenRecordingListener = () => noSub;
export const addExternalDisplayListener = () => noSub;

export const SecureContentView: React.FC<SecureContentViewProps> = ({
  children,
  ...rest
}) => React.createElement(View, rest, children);

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
