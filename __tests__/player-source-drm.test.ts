import { buildPlayerSource, drmFor } from '@/features/video/source';
import type { PlaybackTicket } from '@/types/domain';

/**
 * Playback source construction for the mobile player.
 *
 * This is the logic that decides WHAT the native player is handed. It is a
 * pure function (`src/features/video/source.ts`) shared with the player, so
 * these tests pin the wire contract the player actually uses:
 *
 *   1. Only this platform's own manifest endpoint takes a `maxHeight` query
 *      parameter. A Gumlet URL is used exactly as issued.
 *   2. Captions are never a manifest parameter. The endpoint rejects unknown
 *      parameters, and an earlier build that appended `captions=` made every
 *      captioned lesson fail with a 400.
 *   3. `contentType` is always explicit; `scheme: 'none'` never reaches the
 *      native DRM API.
 */
type Ticket = Pick<PlaybackTicket, 'manifestUrl' | 'playbackHeaders' | 'drm'>;

const hlsTicket: Ticket = {
  manifestUrl: 'https://api.example/api/v1/playback/manifest/t_1/master.m3u8?exp=1&sig=s',
  playbackHeaders: {},
  drm: { scheme: 'none', licenseUrl: null, certificateUrl: null, licenseHeaders: {} },
};

const gumletTicket: Ticket = {
  manifestUrl: 'https://video.gumlet.io/ws_1/asset_1/main.mpd',
  playbackHeaders: {},
  drm: {
    scheme: 'widevine',
    licenseUrl: 'https://widevine.gumlet.com/licence/org_1/asset_1?token=T&expires=1',
    certificateUrl: null,
    licenseHeaders: {},
  },
};

describe('independent mobile HLS tickets', () => {
  it('use the per-ticket manifest URL as issued', () => {
    expect(buildPlayerSource(hlsTicket).uri).toBe(hlsTicket.manifestUrl);
  });

  it('declare HLS explicitly rather than letting expo-video guess', () => {
    expect(buildPlayerSource(hlsTicket).contentType).toBe('hls');
  });

  it('carry no DRM block', () => {
    expect(buildPlayerSource(hlsTicket).drm).toBeUndefined();
    expect(drmFor(hlsTicket)).toBeUndefined();
  });

  it('still send any playback headers the backend issued', () => {
    const s = buildPlayerSource({ ...hlsTicket, playbackHeaders: { 'X-Viewer': 'u_1' } });
    expect(s.headers).toEqual({ 'X-Viewer': 'u_1' });
  });

  it('apply the server-side quality ceiling as maxHeight, keeping the signature', () => {
    const s = buildPlayerSource(hlsTicket, { quality: '480p' });
    expect(s.uri).toContain('maxHeight=480');
    expect(s.uri).toContain('exp=1');
    expect(s.uri).toContain('sig=s');
  });

  it('add no parameter when quality is auto', () => {
    expect(buildPlayerSource(hlsTicket, { quality: 'auto' }).uri).toBe(hlsTicket.manifestUrl);
  });

  it('never add a captions parameter - the endpoint refuses unknown parameters', () => {
    const s = buildPlayerSource(hlsTicket, { quality: '720p' });
    expect(s.uri).not.toContain('captions');
  });

  it('keep a relative manifest path relative', () => {
    const s = buildPlayerSource(
      { ...hlsTicket, manifestUrl: '/playback/manifest/t_1/master.m3u8?exp=1&sig=s' },
      { quality: '360p' }
    );
    expect(s.uri).toBe('/playback/manifest/t_1/master.m3u8?exp=1&sig=s&maxHeight=360');
  });

  it('carry the lesson metadata for the system media session', () => {
    const s = buildPlayerSource(hlsTicket, { metadata: { title: 'Lecture 1', artist: 'Physics' } });
    expect(s.metadata).toEqual({ title: 'Lecture 1', artist: 'Physics' });
  });
});

describe('Gumlet DRM tickets', () => {
  it('use the manifest URL exactly as issued, whatever the quality preference', () => {
    const s = buildPlayerSource(gumletTicket, { quality: '480p' });
    expect(s.uri).toBe('https://video.gumlet.io/ws_1/asset_1/main.mpd');
  });

  it('declare DASH so the native player parses the manifest', () => {
    expect(buildPlayerSource(gumletTicket).contentType).toBe('dash');
  });

  it('pass the signed licence URL through untouched', () => {
    const s = buildPlayerSource(gumletTicket);
    expect(s.drm?.type).toBe('widevine');
    expect(s.drm?.licenseServer).toBe(gumletTicket.drm.licenseUrl);
    expect(s.drm?.multiKey).toBe(true);
  });

  it('use FairPlay over HLS when the backend selected it for iOS', () => {
    const ios: Ticket = {
      ...gumletTicket,
      drm: {
        ...gumletTicket.drm,
        scheme: 'fairplay',
        licenseUrl: 'https://fairplay.gumlet.com/licence/org_1/asset_1?token=T&expires=1',
        certificateUrl: 'https://fairplay.gumlet.com/certificate/org_1/',
      },
    };
    const s = buildPlayerSource(ios);
    expect(s.drm?.type).toBe('fairplay');
    expect(s.drm?.certificateUrl).toContain('certificate');
    expect(s.contentType).toBe('hls');
  });
});

describe('fail-closed behaviour', () => {
  it("never passes scheme 'none' to the native DRM API", () => {
    expect(buildPlayerSource(hlsTicket).drm).toBeUndefined();
  });

  it('treats a DRM scheme with no licence URL as no DRM rather than a half-configured one', () => {
    const broken: Ticket = { ...gumletTicket, drm: { ...gumletTicket.drm, licenseUrl: null } };
    expect(buildPlayerSource(broken).drm).toBeUndefined();
    expect(buildPlayerSource(broken).contentType).toBe('hls');
  });
});
