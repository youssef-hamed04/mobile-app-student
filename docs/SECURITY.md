# Content protection design

This document describes what the app does to protect educational video and
documents, why each layer exists, and — importantly — what it does **not**
guarantee.

---

## 1. Threat model

| Adversary | Capability | Addressed by |
|---|---|---|
| Casual student | Screenshot, built-in screen recorder | Layer A (platform capture blocking) |
| Motivated student | Screen mirroring to a laptop, HDMI capture, Expo Go / patched build | Layer A + Layer B + Layer D |
| Account sharer | Passing credentials to classmates | Layer C (device binding, concurrency) |
| Technical adversary | Proxy interception, `yt-dlp`-style manifest scraping, rooted device | Layer B + Layer D + Layer E |
| Determined adversary | External camera pointed at the screen | **Not preventable.** Mitigated forensically by Layer F (watermarking) |

The last row is the honest limit. No mobile application can defeat a phone
camera pointed at a screen. Everything here is designed to make every *easier*
path harder than that one, and to make the remaining path attributable.

---

## 2. Layer A — platform capture blocking

### Android

`FLAG_SECURE` on the activity window. Set in three places, deliberately
redundant:

1. **`MainActivity.onCreate`** (injected by the config plugin) — so the very
   first frame, including the splash, is already protected.
2. **`SecureContentView.onAttachedToWindow`** — reference-counted per protected
   region.
3. **`ContentProtectionModule.setSecureFlag`** — the JS-controlled toggle, and
   re-applied on `OnActivityEntersForeground` in case an OEM skin cleared it.

`FLAG_SECURE` is a *platform* guarantee, not a heuristic: SurfaceFlinger
refuses to composite the window into screenshots, screen recordings, the
recents thumbnail, and non-secure external displays.

Video output surfaces additionally get `SurfaceView.setSecure(true)`. This
matters because a hardware video surface can otherwise be composited to a
mirrored display independently of the window flag.

**FLAG_SECURE is deliberately left on app-wide** rather than toggled per
screen. Course titles, the student's name and the watermark preview are all
sensitive, toggling causes a visible surface re-creation on some OEM skins, and
a toggle creates a window where a frame can leak.

### iOS

iOS has no `FLAG_SECURE`. The equivalent capability is built from the
`UITextField(isSecureTextEntry: true)` canvas layer, which the render server
excludes from screenshots, ReplayKit recordings, AirPlay mirroring and the
springboard snapshot. `SecureContentView` re-parents the app's own content into
that canvas, so anything drawn inside inherits the exclusion.

This uses a private view *shape*, not a private symbol: the canvas is located
by class-name matching and every step is optional. If Apple changes the
internals, the lookup returns nil, `capabilities.supportsSecureSurface` goes
false, and **the app refuses protected playback** rather than silently
rendering unprotected content. That failure mode is the important part of the
design.

Additionally on iOS:
- A branded opaque overlay is installed on `willResignActive`, so the app
  switcher card never shows lesson content.
- Picture-in-Picture and background audio are hard-disabled — either would move
  protected frames outside the secure surface.

---

## 3. Layer B — capture detection and response

| Signal | Android | iOS |
|---|---|---|
| Screenshot taken | `Activity.registerScreenCaptureCallback` (API 34+) | `userDidTakeScreenshotNotification` |
| Recording in progress | `WindowManager.addScreenRecordingCallback` (API 35+) | KVO on `UIScreen.isCaptured` |
| External / mirrored display | `DisplayManager.DisplayListener` + `Display.FLAG_SECURE` check | `UIScreen.didConnect/didDisconnect` |

Response, implemented in `src/services/content-protection.ts` and
`src/hooks/use-content-protection.ts`:

1. Playback pauses immediately.
2. The opaque **privacy shield** covers the entire app (rendered at the root,
   above every navigator and modal, at `zIndex.shield`).
3. The event is POSTed to `/playback/security-events` with the video, lesson
   and course ids. The audit trail lives **server-side**, where a patched
   client cannot strip it.
4. Recording state is sticky: playback stays blocked until the recording stops.

Screenshots on Android 34+ and iOS have already been blanked by Layer A by the
time the callback fires. The callback exists for the audit trail and to make
the block visible to the student, not to prevent the capture.

---

## 4. Layer C — device binding and anti-sharing

`src/services/device.ts` derives a stable device identity from:

- a 256-bit random secret generated once and stored in the Keychain/Keystore
  with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility — so it is **excluded
  from iCloud/iTunes backups and device-to-device transfer**, which is what
  makes it usable as an anti-sharing signal;
- the vendor/Android install id;
- a coarse hardware descriptor.

Sent on every authenticated request as `X-Device-Id`, plus a human-readable
name so an administrator can identify the handset when approving a re-bind.

Android manifest hardening (`plugins/withSecurityHardening.js`) sets
`allowBackup=false`, `fullBackupContent=false` and a `data_extraction_rules.xml`
that excludes shared prefs, databases and files from cloud backup and device
transfer.

**The client never decides authorization.** It reports identity; the backend
returns `DEVICE_NOT_AUTHORIZED` / `DEVICE_LIMIT_REACHED` /
`DEVICE_CHANGE_PENDING`, which map to specific UI states. Concurrency is
enforced server-side through the playback ticket's `streamSessionId`.

---

## 5. Layer D — video delivery

```
Student → POST /playback/videos/:id/ticket
              ↓  (server: auth → account → course → lesson → video
                          → device → session → concurrency slot)
          PlaybackTicket { signed expiring manifest URL, DRM config,
                           watermark payload, resume position, TTL }
              ↓
          HLS (encrypted) from Cloudflare R2 via signed CDN URL
              ↓
          expo-video inside SecureContentView
```

Properties enforced by the client:

- **There is no code path that produces a playable URL without a ticket.** The
  player renders a spinner, not a `<VideoView>`, until one is issued.
- Tickets are **never persisted**. They are held in component state only, and
  `'playback'` / `'attachments'` are on the query-cache persistence deny-list
  (`NEVER_PERSIST` in `src/api/query-client.ts`) as a second line of defence.
- Tickets are **released on unmount** so a student is not locked out of their
  own next video by the concurrency limit.
- Tickets **rotate before expiry** (`TICKET_REFRESH_LEAD_SECONDS`), so a long
  lesson never stalls mid-playback.
- **Quality selection is a server operation.** The chosen ceiling is sent as a
  query parameter on the manifest request and the backend prunes the ABR
  ladder and re-signs. A client cannot request a rendition it was not
  authorized for, and a data-saver cap cannot be bypassed by editing a local
  playlist.
- **No download affordance exists anywhere in the app**, and protected
  attachments open only in the in-app secure viewer.

Metro is configured to strip `m3u8`, `ts` and `key` from `assetExts` so a
playlist or key can never be accidentally bundled.

### DRM readiness

The ticket carries a complete DRM block:

```ts
drm: { scheme: 'widevine' | 'fairplay' | 'none',
       licenseUrl, certificateUrl, licenseHeaders }
```

`ProtectedVideoPlayer` passes it straight to `expo-video`'s `drm` source
option. Turning DRM on is a **backend change plus one env flag**
(`EXPO_PUBLIC_ENABLE_DRM`) — no client rewrite. Until then the stream is
AES-128 / SAMPLE-AES encrypted HLS behind signed URLs.

---

## 6. Layer E — transport and device integrity

- **Android network security config**: TLS only, and in release builds
  **user-installed CAs are not trusted**. An off-the-shelf interception proxy
  cannot read playback tickets or signed manifest URLs. A `debug-overrides`
  block keeps proxying possible in debug builds against staging.
- **iOS ATS**: `NSAllowsArbitraryLoads: false`, TLS 1.2 minimum.
- **`UIFileSharingEnabled: false`** and `LSSupportsOpeningDocumentsInPlace:
  false` — lesson material cannot be pulled out over USB or Files.app.
- **Integrity probes** (root/jailbreak artefacts, debugger attachment,
  emulator detection) are reported as **signals** in the
  `X-Device-Integrity` header and in the heartbeat, never used as a
  client-side verdict. Production should pair this with Play Integrity /
  App Attest verification server-side — see MANUAL_STEPS §11.
- **Logging is redacted at the source.** `src/services/logger.ts` strips any
  key containing `token`, `password`, `signature`, `key`, `phone`, etc., before
  anything reaches a sink, and only warn/error are emitted in production.
- An ESLint rule bans importing `AsyncStorage` directly, so a token can't be
  written to unencrypted storage by accident.

---

## 7. Layer F — watermarking (forensic, not preventive)

`src/features/video/components/Watermark.tsx`:

- **Server-issued content.** Name, account id and an opaque signed
  `sessionTag` all come from the ticket. Patching the client to display a
  different name does not change what the backend recorded for that session.
- **Two layers.** A prominent moving mark *plus* a faint static diagonal
  tiling. Masking the moving mark leaves the tiled layer; removing the tiled
  layer requires a re-encode that visibly degrades the frame.
- **Nine-cell lattice, non-adjacent walk.** Rather than cycling four corners
  (trivially cropped), the mark walks a 3×3 grid in a shuffled order that never
  repeats or lands adjacent to the previous cell. Cropping any single region
  loses content in most cycles.
- **Time-coded.** The second line carries wall-clock time, pinning a leak to a
  session window, not just an account.
- **Above everything, inside the secure surface.** Rendered after the controls
  at `zIndex.watermark`, and *inside* `SecureContentView` — so no capture can
  catch the frame with the watermark stripped.

The same watermark is applied to protected documents in the secure viewer.

---

## 8. What this does not do

Stated plainly, because pretending otherwise leads to bad decisions:

1. **An external camera defeats all of it.** Watermarking is the answer, and
   it is a forensic answer, not a preventive one.
2. **A rooted device with a modified framework can strip `FLAG_SECURE`.** Root
   detection is a signal, not a barrier. Server-side attestation is what makes
   this expensive.
3. **iOS secure-surface behaviour depends on a UIKit implementation detail.**
   The failure mode is "refuse to play", not "play unprotected", but a future
   iOS version could require reworking this layer.
4. **Without DRM, a sufficiently determined attacker who extracts a valid
   ticket within its TTL can pull the segments.** Short TTLs, device binding,
   concurrency limits and CA pinning raise the cost; Widevine/FairPlay is what
   closes it. The architecture is ready — see MANUAL_STEPS §10.
5. **Screenshot detection below Android 14 is not available.** `FLAG_SECURE`
   still blanks the capture; you just don't get the audit event.

---

## 9. Server-side responsibilities

The client is untrusted. The backend must own:

- every authorization decision in the playback chain;
- ticket signing, TTL and single-session enforcement;
- watermark payload composition and signing;
- the security-event audit log;
- device binding state and re-bind approval;
- Play Integrity / App Attest verification;
- CDN URL signing (Cloudflare R2 + signed URLs or Cloudflare Stream);
- rate limiting on ticket issuance — the single best defence against bulk
  scraping.
