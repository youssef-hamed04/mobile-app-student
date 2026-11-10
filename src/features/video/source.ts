import type { VideoSourceObject } from 'expo-video';

import type { PlaybackTicket } from '@/types/domain';

export type PlayerDrm = NonNullable<VideoSourceObject['drm']>;

/**
 * The DRM block the native player is handed, or `undefined` for a stream that
 * carries none.
 *
 * `scheme: 'none'` is NOT a DRM scheme the player can use - expo-video would
 * reject it - so the guard is `scheme !== 'none' && licenseUrl`, never just
 * the string. A licence URL is only ever present on the Gumlet (web-DRM) path;
 * the independent mobile pipeline is AES-128 HLS and arrives as `none`.
 */
export function drmFor(ticket: Pick<PlaybackTicket, 'drm'>): PlayerDrm | undefined {
  const { scheme, licenseUrl, licenseHeaders, certificateUrl } = ticket.drm;
  if (scheme === 'none' || !licenseUrl) return undefined;
  return {
    type: scheme,
    licenseServer: licenseUrl,
    headers: licenseHeaders,
    certificateUrl: certificateUrl ?? undefined,
    multiKey: true,
  };
}

/**
 * Builds the source the native player loads from a playback ticket.
 *
 * Two pipelines arrive through the same ticket shape:
 *
 *  - **Independent mobile HLS** (`drm.scheme === 'none'`): the manifest is this
 *    platform's own per-ticket endpoint. It accepts `maxHeight`, which the
 *    backend applies by pruning the ladder and re-signing, so the quality cap
 *    is enforced server-side and cannot be bypassed by editing a playlist.
 *    Caption tracks are sidecar files chosen in the app and are NOT a manifest
 *    parameter: the endpoint rejects unknown query parameters, so sending one
 *    (as an earlier build did) made every captioned lesson fail with a 400.
 *
 *  - **Gumlet DRM** (`widevine` / `fairplay`): the manifest is Gumlet's CDN
 *    URL and the licence is bound to it, so it is used exactly as issued. The
 *    quality selector is left to the platform's ABR.
 *
 * `contentType` is always explicit: without it expo-video falls back to
 * `progressive`, which cannot play a segmented manifest. DRM content follows
 * the key system - FairPlay is HLS-only at Gumlet, Widevine is DASH.
 */
export function buildPlayerSource(
  ticket: Pick<PlaybackTicket, 'manifestUrl' | 'playbackHeaders' | 'drm'>,
  options: { quality?: string; metadata?: { title?: string; artist?: string } } = {}
): VideoSourceObject {
  const drm = drmFor(ticket);
  const isDrm = drm !== undefined;

  let url = ticket.manifestUrl;
  if (!isDrm && options.quality && options.quality !== 'auto') {
    // `new URL` on a relative path would throw, so a base is supplied and
    // stripped back off when the original was relative.
    const parsed = new URL(url, 'https://placeholder.invalid');
    parsed.searchParams.set('maxHeight', options.quality.replace('p', ''));
    url = ticket.manifestUrl.startsWith('http')
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}`;
  }

  return {
    uri: url,
    headers: ticket.playbackHeaders,
    metadata: options.metadata,
    contentType: !isDrm || drm?.type === 'fairplay' ? 'hls' : 'dash',
    drm,
  };
}
