import * as ImagePicker from 'expo-image-picker';

import { api } from '@/api/client';
import { Endpoints } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import { createLogger } from '@/services/logger';
import type { User } from '@/types/domain';

const log = createLogger('avatar');

/**
 * Changing the profile picture.
 *
 * Three steps, and the shape of them is the backend's:
 *
 *   1. `POST /storage/uploads/avatar` → `{ uploadUrl, objectKey, expiresIn,
 *      requiredHeaders }`. **The server chooses the key**; a client cannot name
 *      one, so nothing here can decide where the object lands.
 *   2. `PUT` the bytes straight to `uploadUrl`, replaying `requiredHeaders`
 *      exactly — the signature covers the method, the key and the content type,
 *      so an extra or missing header is a refusal from storage rather than a
 *      validation message.
 *   3. `PUT /profile/avatar { avatarUrl: objectKey }`. The API never accepts
 *      image bytes on the profile route.
 *
 * Step 2 does not go through the API at all, which is the point: the bytes
 * never occupy a Node worker.
 */

/** Exactly the allow-list the backend's `@IsIn(IMAGE_TYPES)` enforces. */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** `@Max(5 * 1024 * 1024)` on `sizeBytes`. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

interface SignedUpload {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
  requiredHeaders: Record<string, string>;
}

export interface PickedImage {
  uri: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Asks for a picture.
 *
 * Returns `null` when the student backs out — a cancellation is an ordinary
 * outcome, not an error, and must not surface as one. Permission refusal is
 * distinguished from cancellation because only one of them is worth explaining.
 */
export async function pickAvatar(): Promise<
  { ok: true; image: PickedImage } | { ok: false; reason: 'cancelled' | 'denied' }
> {
  // No runtime permission request: the image library is opened through the
  // system photo picker (PHPicker on iOS, the Android photo picker), which
  // runs outside the app and only returns the image the student chose. This
  // is what lets the build ship without CAMERA / storage permissions and
  // without a full photo-library prompt. `denied` is kept in the return type
  // for callers, and is still reported if the platform refuses to open.
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      // Re-encoded well below the 5 MB ceiling. A phone camera original is
      // routinely larger than that, and rejecting it after the upload has
      // started would be a poor way to discover the limit.
      quality: 0.8,
    });
  } catch (e) {
    log.warn('image picker failed to open', { e: String(e) });
    return { ok: false, reason: 'denied' };
  }

  if (result.canceled || !result.assets[0]) return { ok: false, reason: 'cancelled' };

  const asset = result.assets[0];
  return {
    ok: true,
    image: {
      uri: asset.uri,
      // The picker reports the type of the re-encoded asset; it falls back to
      // JPEG only when the platform declines to say, which the server's
      // allow-list will catch either way.
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    },
  };
}

/** Rejects what the server would reject, before spending a round trip. */
export function validateAvatar(image: PickedImage): string | null {
  if (!AVATAR_TYPES.includes(image.mimeType as (typeof AVATAR_TYPES)[number])) {
    return 'unsupportedType';
  }
  if (image.sizeBytes > AVATAR_MAX_BYTES) return 'tooLarge';
  return null;
}

/**
 * Runs the three steps and returns the updated user.
 *
 * Throws `ApiError` throughout — including for the storage PUT, which is a
 * plain `fetch` outside the API client and would otherwise surface a raw
 * `TypeError` that no error boundary in the app knows how to render.
 */
export async function uploadAvatar(image: PickedImage): Promise<User> {
  const signed = await api.post<SignedUpload>(Endpoints.storage.avatarUpload, {
    contentType: image.mimeType,
    sizeBytes: image.sizeBytes,
  });

  // `fetch` on a file:// URI yields the real bytes; this is the one supported
  // way to get a body for a raw PUT in React Native.
  const body = await fetch(image.uri).then((r) => r.blob());

  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.requiredHeaders,
    body,
  }).catch((e: unknown) => {
    log.error('avatar upload transport failure', { e: String(e) });
    throw new ApiError({
      code: 'UPLOAD_FAILED',
      status: 0,
      message: 'The upload could not reach storage',
    });
  });

  if (!response.ok) {
    log.error('storage refused the avatar upload', { status: response.status });
    throw new ApiError({
      code: 'UPLOAD_FAILED',
      status: response.status,
      message: `Storage refused the upload (${response.status})`,
    });
  }

  return api.put<User>(Endpoints.profile.avatar, { avatarUrl: signed.objectKey });
}

/** Clearing the picture is the same route with a null key. */
export function removeAvatar(): Promise<User> {
  return api.put<User>(Endpoints.profile.avatar, { avatarUrl: null });
}
