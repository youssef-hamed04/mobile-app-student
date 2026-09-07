import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { env } from '@/config/env';

import { createLogger } from './logger';
import { SecureKeys, secureGet, secureSet } from './secure-storage';

const log = createLogger('device');

/**
 * Device identity used for DEVICE BINDING (spec §36).
 *
 * Design notes:
 *  - The stable part is a random 256-bit secret generated once and kept in
 *    the Keychain/Keystore with THIS_DEVICE_ONLY accessibility. It therefore
 *    does not survive a backup restore onto another handset, which is what
 *    makes it usable as an anti-account-sharing signal.
 *  - We additionally send a coarse hardware descriptor so the backend can
 *    show the student a human-readable device name ("Samsung Galaxy S23")
 *    when asking an admin to re-bind, and can flag suspicious mismatches.
 *  - The client NEVER decides whether the device is authorized. It only
 *    reports identity; the backend returns 403 DEVICE_NOT_AUTHORIZED.
 *  - Root/jailbreak state is reported as an attestation *signal*, not a
 *    client-side block.
 */

export interface DeviceIdentity {
  /** Opaque stable id derived from the keystore secret. Sent as X-Device-Id. */
  deviceId: string;
  /** Human readable, shown in "authorized devices" UI. */
  name: string;
  platform: 'ios' | 'android' | 'other';
  osVersion: string;
  model: string;
  manufacturer: string;
  appVersion: string;
  buildVersion: string;
  isPhysicalDevice: boolean;
  /** True when the OS integrity looks compromised (root / jailbreak / emulator). */
  integritySuspect: boolean;
}

let cached: DeviceIdentity | null = null;
let inflight: Promise<DeviceIdentity> | null = null;

async function randomHex(bytes: number): Promise<string> {
  const buf: Uint8Array = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(buf, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

async function loadOrCreateSecret(): Promise<string> {
  const existing = await secureGet(SecureKeys.deviceSecret);
  if (existing) return existing;

  const secret = await randomHex(32);
  await secureSet(SecureKeys.deviceSecret, secret);
  log.info('generated new device secret');
  return secret;
}

async function deriveDeviceId(secret: string): Promise<string> {
  const cachedId = await secureGet(SecureKeys.deviceId);
  if (cachedId) return cachedId;

  // Bind the id to the install as well, so a reinstall on the same handset
  // produces a new id and the backend can distinguish "same phone, fresh
  // install" from "different phone".
  let installId = 'web-browser';
  if (Platform.OS === 'android') {
    try {
      installId = (await Application.getAndroidId()) ?? 'unknown';
    } catch {
      installId = 'unknown-android';
    }
  } else if (Platform.OS === 'ios') {
    try {
      installId = (await Application.getIosIdForVendorAsync()) ?? 'unknown';
    } catch {
      installId = 'unknown-ios';
    }
  }

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}:${installId}:${Device.modelId ?? Device.modelName ?? 'unknown'}`
  );

  await secureSet(SecureKeys.deviceId, digest);
  return digest;
}

function detectIntegrityRisk(): boolean {
  if (!env.features.rootDetection) return false;
  // Emulators are the cheapest large-scale extraction vector; treat them as
  // suspect outside development. Deeper checks (Play Integrity / DeviceCheck)
  // are performed server-side — see docs/SECURITY.md.
  const suspiciousModel = /generic|emulator|sdk_gphone|vbox|genymotion/i.test(
    `${Device.modelName ?? ''} ${Device.designName ?? ''}`
  );
  return (!Device.isDevice || suspiciousModel) && env.env !== 'development';
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const secret = await loadOrCreateSecret();
    const deviceId = await deriveDeviceId(secret);

    const identity: DeviceIdentity = {
      deviceId,
      name:
        Device.deviceName ??
        `${Device.manufacturer ?? ''} ${Device.modelName ?? 'Device'}`.trim(),
      platform:
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other',
      osVersion: Device.osVersion ?? 'unknown',
      model: Device.modelName ?? 'unknown',
      manufacturer: Device.manufacturer ?? 'unknown',
      appVersion: env.appVersion,
      buildVersion: Application.nativeBuildVersion ?? '0',
      isPhysicalDevice: Device.isDevice,
      integritySuspect: detectIntegrityRisk(),
    };

    cached = identity;
    return identity;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Headers attached to every authenticated request for device binding. */
export async function deviceHeaders(): Promise<Record<string, string>> {
  const d = await getDeviceIdentity();
  return {
    'X-Device-Id': d.deviceId,
    'X-Device-Platform': d.platform,
    'X-Device-Model': d.model,
    'X-Device-Name': encodeURIComponent(d.name),
    'X-Device-Os': d.osVersion,
    'X-App-Version': d.appVersion,
    'X-App-Build': d.buildVersion,
    'X-Device-Integrity': d.integritySuspect ? 'suspect' : 'ok',
  };
}
