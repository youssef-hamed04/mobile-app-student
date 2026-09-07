# MANUAL STEPS REQUIRED

Everything below has to be done by a human. Nothing in this list can be
completed from inside the codebase. They are ordered so that each one only
depends on the ones above it.

Legend for each step: **what · where · why · what value · where it goes · how
to verify.**

---

## 1. Install dependencies and generate the native projects

**What:** Install packages and run the Expo prebuild.

**Where:** A terminal in the project root, on macOS (for iOS) or any OS (for
Android only).

**Why:** `ios/` and `android/` are not committed — they are generated from
`app.config.ts` and the config plugins. Until you run prebuild, the native
content-protection module and the security hardening are not applied to
anything.

**Commands:**

```bash
npm install
npx expo prebuild --clean
```

**Verify:**

```bash
# The FLAG_SECURE injection landed in MainActivity:
grep -n "FLAG_SECURE" android/app/src/main/java/**/MainActivity.kt

# The hardening XML files were written:
ls android/app/src/main/res/xml/
#   -> network_security_config.xml   data_extraction_rules.xml

# The native module is linked:
grep -rn "ContentProtection" android/settings.gradle ios/Podfile.lock
```

If `grep` finds nothing in `MainActivity.kt`, the plugin didn't run — re-run
with `--clean`.

---

## 2. Prerequisites: toolchains

**What:** Install the native build toolchains.

**Where:** Your development machine.

| Target | Requirement |
|---|---|
| Android | JDK 17, Android Studio, SDK Platform 35, Build-Tools 35, an emulator or device with USB debugging |
| iOS | macOS, Xcode 16+, CocoaPods (`sudo gem install cocoapods`), iOS 15.1+ simulator or device |

**Why:** Expo Go cannot run this app (see §4). You need real native builds.

**Verify:** `npx expo run:android` and `npx expo run:ios` both compile and
launch.

---

## 3. Environment variables

**What:** Fill in the real values in the `.env.*` files.

**Where:** `.env.development`, `.env.staging`, `.env.production` in the project
root. `.env.example` documents every key.

**Why:** `src/config/env.ts` validates these with Zod **at startup and throws
if any are missing or malformed** — deliberately, so a misconfigured build
fails loudly instead of silently pointing at the wrong API.

**Values you must provide:**

| Key | Value | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base REST URL **including the version segment**, e.g. `https://api.yourdomain.com/api/v1` | Android emulator uses `http://10.0.2.2:3000/api/v1` for a local backend; iOS simulator uses `http://localhost:3000/api/v1`; a physical device needs your machine's LAN IP |
| `EXPO_PUBLIC_USE_MOCKS` | `true` until the backend exists, then `false` | Forced to `false` in production builds regardless |
| `EXPO_PUBLIC_SUPPORT_PHONE` | Admin phone in international format, e.g. `+201001234567` | Used by the "contact administration" flow — this is the **only** password-recovery path, so it must be correct |
| `EXPO_PUBLIC_SUPPORT_WHATSAPP` | WhatsApp number, same format | |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Support inbox | |
| `EXPO_PUBLIC_ENABLE_DRM` | `false` now, `true` once the license server is live (§10) | |
| `EXPO_PUBLIC_PLAYBACK_TICKET_TTL` | Seconds, e.g. `300` | Must match the backend's signing TTL |

Also set the same values in **`eas.json`** under `build.<profile>.env` — EAS
Build does not read local `.env` files.

**Never** put a secret here. Everything with an `EXPO_PUBLIC_` prefix is
inlined into the JS bundle and is readable by anyone with the APK.

**Verify:** Launch the app. If a value is missing you get an explicit
`Invalid environment configuration` error naming the key. Then open
**Settings → About** and confirm the environment label reads what you expect.

---

## 4. Understand the Expo Go limitation

**What:** Nothing to do — but you must know this before testing.

**Why:** Screenshot protection, screen-recording detection and the secure
rendering surface are a **custom native module**. Expo Go cannot load it.

**Behaviour in Expo Go:** `capabilities.isSupported` is `false`, and the app
**refuses to play protected video** and shows the "unsupported device" screen.
This is intentional: degrading to unprotected playback would be worse than not
playing.

**Verify:** In a development build, open **Settings → Privacy and security**.
Every signal row should show a green check. In Expo Go they show warnings.

---

## 5. Create the EAS project

**What:** Link the app to Expo Application Services.

**Where:** Terminal, then https://expo.dev.

```bash
npm install -g eas-cli
eas login
eas init            # creates the project, prints a project id
eas update:configure
```

**Why:** The EAS project id is required for push notifications
(`getExpoPushTokenAsync`) and for OTA updates.

**Value and destination:**
- The printed project id → `EAS_PROJECT_ID` in every `.env.*` **and** in
  `eas.json` build profile envs. It is read by `app.config.ts` into
  `extra.eas.projectId`.
- The updates URL printed by `update:configure` → `EXPO_UPDATES_URL`.

**Verify:** `npx expo config --type public | grep -A2 '"eas"'` shows your real
project id, not the zero UUID placeholder.

---

## 6. Push notification credentials

### Android (FCM)

**What:** Create a Firebase project and upload the FCM V1 service account key.

**Where:** https://console.firebase.google.com → your project → Project
settings.

1. Add an Android app with package name `com.eduplatform.app` (and
   `com.eduplatform.app.dev` / `.stg` if you want push in those variants).
2. Download `google-services.json`.
3. Project settings → Service accounts → **Generate new private key** → JSON.

**Where the values go:**
- `google-services.json` → project root. It is **already in `.gitignore`** —
  keep it there. Reference it from `app.config.ts` under
  `android.googleServicesFile` if you build locally, or upload it to EAS
  secrets for cloud builds.
- The service-account JSON → `eas credentials` → Android → *FCM V1 service
  account key*.

**Verify:** `eas credentials -p android` lists an FCM V1 key. Then trigger a
test push from the Expo push tool
(https://expo.dev/notifications) using the token the app logs on first launch.

### iOS (APNs)

**What:** Create an APNs key.

**Where:** https://developer.apple.com → Certificates, Identifiers & Profiles →
Keys → **+** → enable *Apple Push Notifications service*.

**Value:** the downloaded `AuthKey_XXXXXXX.p8`, plus the Key ID and your Team
ID.

**Where it goes:** `eas credentials -p ios` → Push Notifications → upload. Do
**not** commit the `.p8` (already gitignored).

**Verify:** `eas credentials -p ios` shows a push key. Then send a test push to
a physical device — the iOS simulator cannot receive remote pushes.

---

## 7. Apple Developer configuration

**What:** App ID, capabilities, and App Store Connect record.

**Where:** developer.apple.com and appstoreconnect.apple.com.

1. **Identifiers** → register `com.eduplatform.app` (explicit, not wildcard).
   Enable *Push Notifications*.
2. **App Store Connect** → My Apps → **+** → New App. Note the **App ID**
   (a numeric string, called `ascAppId`).
3. Note your **Team ID** (top right of the developer portal).

**Where the values go:** `eas.json` → `submit.production.ios`:

```json
"appleId": "you@example.com",
"ascAppId": "1234567890",
"appleTeamId": "ABCDE12345"
```

**Why:** Without these `eas submit -p ios` cannot upload the build.

**Verify:** `eas submit -p ios --latest` reaches the upload stage without
asking for these interactively.

---

## 8. Google Play configuration

**What:** Play Console app + a service account for automated submission.

**Where:** https://play.google.com/console and Google Cloud Console.

1. Play Console → **Create app** with package `com.eduplatform.app`.
2. Google Cloud Console → the linked project → IAM & Admin → Service Accounts →
   create one → **Keys** → Add key → JSON.
3. Play Console → Users and permissions → **Invite** the service account email
   → grant *Release apps to testing tracks* and *Release to production*.

**Value:** the service-account JSON key file.

**Where it goes:** save as `credentials/play-service-account.json` (the
`credentials/` directory is gitignored) — the path is already referenced in
`eas.json` → `submit.production.android.serviceAccountKeyPath`.

**Verify:** `eas submit -p android --latest` uploads to the `internal` track
without prompting.

---

## 9. Android signing keystore

**What:** Let EAS generate and hold your upload keystore, or upload your own.

**Where:** `eas credentials -p android`.

**Why:** Play requires a consistent upload key. Losing it means you cannot
update the app.

**Recommended:** choose *Let EAS handle it*, then immediately run
`eas credentials -p android` → **Download keystore** and store the file and its
passwords in your password manager. EAS keeping a copy is not a backup
strategy.

**Verify:** `eas build -p android --profile production` completes and produces
a signed `.aab`.

---

## 10. Video infrastructure — Cloudflare R2 + HLS

This is a **backend** task, listed here because the mobile app cannot play real
lessons until it exists.

**What:** Storage, transcoding, and signed delivery.

**Where:** Cloudflare dashboard + your NestJS service.

1. **R2 bucket** — create one, e.g. `edu-video-prod`. Create an R2 API token
   (Account → R2 → Manage API Tokens) with object read/write.
   **These credentials go in the backend's environment only. Never in this
   app.**
2. **Transcoding** — an FFmpeg worker that turns each uploaded master into an
   HLS ladder at 360p / 480p / 720p / 1080p with AES-128 or SAMPLE-AES
   encryption, and writes the segments + playlists to R2.
3. **Signed delivery** — put a Cloudflare Worker or CDN in front of R2 that
   validates a short-lived signed URL. The backend returns that URL as
   `manifestUrl` in the playback ticket.
4. **Quality ceiling** — the delivery layer must honour a `?maxHeight=720`
   query parameter by serving a pruned master playlist. The app sends this for
   explicit quality selection and for data saver. (See
   `ProtectedVideoPlayer` → `source` memo.)

**Simpler alternative:** Cloudflare Stream does 2–4 for you and issues signed
tokens natively. If you use it, `manifestUrl` becomes the Stream HLS URL and
`playbackHeaders` stays empty.

**Verify:** `curl` the `manifestUrl` from a ticket — it must return a master
playlist. Then `curl` it again after the TTL expires — it must return 403.

---

## 11. DRM (optional, when you want it)

**What:** A Widevine + FairPlay license server.

**Where:** A DRM provider (Axinom, EZDRM, BuyDRM, Verimatrix) or Cloudflare
Stream's built-in DRM.

**Values you need:**

| Value | Destination |
|---|---|
| Widevine license URL | Backend → `PlaybackTicket.drm.licenseUrl` |
| FairPlay license URL | Same field, when the client is iOS |
| FairPlay certificate (`.cer`) URL | Backend → `PlaybackTicket.drm.certificateUrl` |
| License request auth header/token | Backend → `PlaybackTicket.drm.licenseHeaders` |

**In this app:** set `EXPO_PUBLIC_ENABLE_DRM=true`. **No client code changes
are needed** — the ticket's `drm` block is passed straight through to
`expo-video`.

**Also required:** the transcoder must produce CENC (Widevine) and/or
SAMPLE-AES (FairPlay) packaged output, not plain AES-128.

**Verify:** Play a lesson on a physical Android device with
`EXPO_PUBLIC_ENABLE_DRM=true` — a Widevine license request should appear in
your provider's dashboard. FairPlay requires a physical iPhone (the simulator
has no FairPlay support).

---

## 12. Server-side device attestation

**What:** Verify Play Integrity (Android) and App Attest / DeviceCheck (iOS) in
the backend.

**Where:** Google Play Console → Setup → App integrity; Apple Developer → your
App ID capabilities.

**Why:** The app sends `X-Device-Integrity: suspect|ok`, which a patched client
can lie about. Real attestation is the only version of this signal that means
anything, and it has to be verified server-side.

**Value:** Play Integrity decryption keys (from Play Console) and your Apple
Team ID + key.

**Where it goes:** Backend environment only.

**Verify:** Sideload the app onto a rooted device or an emulator and confirm
the backend refuses to issue a playback ticket.

---

## 13. Production domain and TLS

**What:** Point `api.yourdomain.com` at the NestJS service with a valid
certificate from a public CA.

**Why:** The Android release build **does not trust user-installed CAs**
(`network_security_config.xml`) and iOS ATS requires TLS 1.2+. A self-signed or
internal-CA certificate will cause every request to fail in release builds with
no obvious error.

**Verify:** `curl -v https://api.yourdomain.com/api/v1/meta/health` from a
machine with a clean trust store returns 200 with no certificate warnings.

If you need to proxy traffic during development, use a **debug** build — the
`debug-overrides` block in the network security config allows user CAs there.

---

## 14. Store listing assets

**What:** Replace the generated placeholder artwork.

**Where:** `assets/images/`.

| File | Requirement |
|---|---|
| `icon.png` | 1024×1024, no transparency, no rounded corners (iOS rounds it) |
| `adaptive-icon.png` | 1024×1024 foreground, keep content inside the central 66% safe zone |
| `splash.png` | Centered logo on the brand background |
| `notification-icon.png` | 96×96, **white silhouette on transparent** — Android tints it; a coloured icon renders as a white square |
| `favicon.png` | 48×48 |

The files currently in the repo are programmatically generated placeholders in
the brand palette. They will build and run, but they are not final artwork.

**Also needed for the stores, outside the repo:** phone and tablet screenshots
(iOS 6.7" and 5.5", Android phone + 7" + 10"), a 1024×500 Play feature graphic,
a privacy policy URL, and app descriptions in English and Arabic.

**Verify:** `npx expo prebuild --clean`, then check the app icon on a device
home screen and pull down a test notification to check the small icon.

---

## 15. Backend implementation

**What:** Build the NestJS API to the contract.

**Where:** `docs/API_CONTRACT.md` lists every endpoint the app calls, with
request and response shapes and the exact error codes the UI branches on.

**Critical points that are easy to get wrong:**

1. **Error codes are a contract.** The app renders localized messages keyed by
   `code`, never by the server's `message` string. An unknown code falls back
   to a generic message. The full list is in `src/types/api.ts`.
2. **Response envelope** is `{ "data": ... }`. Bare responses are tolerated but
   the envelope is preferred.
3. **Section structure is fully dynamic.** Do not assume three parts. The app
   renders whatever array you send, in the order you send it.
4. **Progress must be monotonic** server-side — the client assumes percent
   never decreases.
5. **Playback tickets must be single-session and short-lived**, and
   `DELETE /playback/tickets/:id` must actually free the concurrency slot.

**Verify:** Set `EXPO_PUBLIC_USE_MOCKS=false`, point at your API, and walk the
whole flow: register → browse → join → sections → lesson → play → progress →
resume.

---

## 16. First builds

```bash
# Internal distribution build to hand to testers
eas build --profile staging -p android
eas build --profile staging -p ios

# Store builds
eas build --profile production -p android   # .aab
eas build --profile production -p ios       # .ipa
eas submit -p android --latest
eas submit -p ios --latest
```

**Verify the security layer on real hardware before you ship:**

- [ ] Take a screenshot while a lesson plays on **Android** → the saved image is
      black.
- [ ] Start the built-in screen recorder on **Android** → playback pauses and
      the shield appears.
- [ ] Take a screenshot while a lesson plays on **iOS** → the video region is
      blank in the saved image.
- [ ] Start a Control Center recording on **iOS** → playback pauses.
- [ ] Background the app mid-lesson → the app switcher card shows the branded
      placeholder, not the video.
- [ ] AirPlay / cast to a TV → playback is refused.
- [ ] Confirm the watermark shows the correct student name and moves.
- [ ] Sign in on a second device → protected playback is refused with
      "device not authorized".
- [ ] Switch to Arabic → the whole UI mirrors, but the **video timeline does
      not**.
- [ ] Switch to dark mode → text contrast and player controls remain legible.
- [ ] Turn on airplane mode mid-lesson → the offline banner appears and
      progress is queued, then flushes on reconnect.

---

## 17. Things intentionally left for you to decide

These are product decisions, not missing code:

1. **Payment provider.** `EnrollSheet` opens `payment.checkoutUrl` in the
   external browser (so card data never touches the app and the student sees
   the provider's TLS indicator). Wire Paymob / Fawry / Stripe on the backend
   and return the URL.
2. **Terms / privacy / content-policy URLs.** Currently the About screen routes
   these to email. Replace with real URLs once they exist.
3. **Course thumbnails.** The domain model has `thumbnailUrl`; the mock data
   sends `null` and the UI falls back to an icon. Serve real images.
4. **Analytics / crash reporting.** `src/services/logger.ts` exposes
   `addLogSink()` — register Sentry or your provider from `app/_layout.tsx`.
   Nothing is wired by default, on purpose.
