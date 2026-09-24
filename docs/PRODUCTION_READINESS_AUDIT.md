# EduPlatform mobile — production-readiness audit

Audit date: 2026-09-23 · Project: `edu-mobile-final/mobile-app-student`
This file supersedes the store/release parts of `docs/MANUAL_STEPS.md` where
they disagree (EAS project id, API URL location, eas.json submit fields).

---

## 1. Final status

**NOT READY** for store submission today — but everything left is either
**external configuration** or a **product/backend decision**. No known code
defect in the mobile app remains that would stop a build.

Two findings that decide the timeline:

1. **Payment-policy risk (both stores).** The app unlocks paid digital content
   (courses, course parts) with access cards bought outside the app, sells
   Library content in-app for wallet credit loaded from recharge cards, and —
   if any course has the `PAYMENT` enrollment method enabled — opens an
   external Paymob checkout for a course. See §9. This is the most likely
   reason for rejection and needs your decision; it was not changed.
2. **Account deletion.** Both stores require in-app account deletion for apps
   with account creation. The backend has no self-service deletion endpoint.
   The app now files a deletion request in-app (support ticket). A backend
   endpoint that actually deletes is still recommended (§9).

Build-blocking defects that existed before this audit and are now fixed:

| # | Defect | Effect before fix |
|---|---|---|
| 1 | `package-lock.json` out of sync with `package.json` (`@emnapi/core`, `@emnapi/runtime` missing) | `npm ci` fails (npm 10 and 11) → every EAS build fails at install |
| 2 | `ThemeProvider.tsx` imported `@react-navigation/native` | Metro refuses to bundle under SDK 57 ("expo-router is no longer compatible with react-navigation") → every release build fails at JS bundling |
| 3 | `eas.json` pinned Node `20.18.0` | Below React Native 0.86's engine range (`^20.19.4 ‖ ^22.13 ‖ ^24.3`) |
| 4 | Production API URL was the placeholder `https://api.example.com/api/v1`; EAS project id fell back to an all-zero UUID | Store build would ship pointing at a non-existent API; push tokens impossible; OTA disabled |

---

## 2. What was verified (actually run)

| Check | Result |
|---|---|
| `npm ci` with the fixed lockfile (npm 10.9 and npm 11) | pass |
| `npx tsc --noEmit` | pass (0 errors) |
| `npx jest` | 13 suites, 253 tests pass (was 12 / 237) |
| `npx eslint . --ext .ts,.tsx` | 27 errors / 54 warnings (baseline 26 / 53). All errors are React-Compiler advisory rules (`react-hooks/refs`, `immutability`, `set-state-in-effect`) plus 1 unused import in a test; 2 were fixed, 3 of the same pre-existing kind were added by the player fix. They do not affect the build. |
| `npx expo export --platform android --platform ios` with production env | pass — Hermes bundles for both platforms (fails before fix #2) |
| Production bundle scan | no `10.0.2.2`, no `api.example.com`, no `support@example.com`, no private keys / R2 / JWT / HMAC secrets |
| `npx expo prebuild --clean` (production variant) and inspection of the generated `AndroidManifest.xml`, `Info.plist`, `PrivacyInfo.xcprivacy`, `gradle.properties` | as described in §6–§7 |
| Production env guard | refuses `api.example.com`, missing URL, placeholder support contacts |
| `npx expo-doctor` | 19/21 pass; the 2 failures are network lookups the audit sandbox could not reach (config schema download, React Native Directory) — **re-run locally** |

**Not run (cannot be run in the audit sandbox — run them yourself):**
`eas build` (Android/iOS), Gradle `bundleRelease`, Xcode archive, install on a
device, push delivery, real HLS playback, RTL on a handset.

```bash
npm ci
npx expo-doctor
npm run typecheck && npm test
eas build -p android --profile production
eas build -p ios --profile production
```

---

## 3. Files changed

| File | What changed | Why |
|---|---|---|
| `package-lock.json` | Added the two missing `@emnapi/*` entries (no other version moved) | `npm ci` failed → EAS install step failed |
| `eas.json` | Removed Node pin; removed placeholder prod/staging API URLs; added `environment` per profile; removed `REPLACE_WITH_…` submit placeholders; Android submit `releaseStatus: draft` | Node below RN engine; secrets/URLs belong in EAS env vars; placeholders make `eas submit` fail; Play requires draft for a never-published app |
| `app.config.ts` | Build-time production guard (API URL https / not local / not placeholder, support contacts not placeholders, mocks off); no fake EAS project id; OTA URL derived from project id; iOS privacy manifest; blocked unused Android permissions (CAMERA, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE); removed unused iOS camera/microphone/Face ID strings via plugin options | Misconfigured store build now fails at build time instead of at runtime; required-reason API declarations; no unexplained permissions |
| `plugins/withSecurityHardening.js` | Cleartext loopback domains + iOS `NSAllowsLocalNetworking` only in non-production; stopped forcing `enableOnBackInvokedCallback=true`; Gradle locale/encoding JVM args | Release manifest permitted cleartext; forced predictive-back overrode Expo's tested default; Arabic system locale breaks local Gradle codegen |
| `src/theme/ThemeProvider.tsx` | Theme primitives imported from `expo-router` | Build blocker #2 |
| `src/config/env.ts` | Optional `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Store-required pages reachable in-app |
| `src/api/client.ts` | (a) transport errors classified offline / timeout / server-unreachable; cancelled requests no longer retried; (b) a failed token refresh only ends the session on a definitive 400/401/403/session-ending answer — offline/5xx no longer signs the student out; (c) retried request errors are no longer relabelled "session expired"; (d) `Retry-After` > 10 s is not waited on; (e) `skipRefresh` also skips the proactive refresh | Every API failure was reported as "no internet"; opening the app offline with a stale token logged the student out |
| `src/api/errors.ts`, `src/types/api.ts`, `src/components/ui/ErrorState.tsx`, `src/i18n/locales/{en,ar}.json` | New `SERVER_UNREACHABLE` code with EN/AR copy | Accurate error message when Wi-Fi is fine but the API is down |
| `src/features/auth/AuthProvider.tsx` | Push token unregistered before tokens are cleared; re-entrant teardown guarded | Unregister was sent without credentials, and a voluntary logout could fire a second teardown + "session expired" toast |
| `src/services/notifications.ts` | Unregister uses `skipRefresh`; exposes the initial notification response | Supports the two fixes above/below |
| `src/api/endpoints.ts` | Push token path segment URL-encoded | `ExponentPushToken[…]` brackets |
| `src/app/_layout.tsx` | `Stack.Protected` around every signed-in route; notification taps routed once (dedupe across cold start + listener) | Deep links / notification taps reached protected screens while signed out; the same tap could navigate twice |
| `src/services/kv.ts` | Key for last handled notification | Dedupe |
| `src/utils/guards.ts` | Deep-link allow-list also accepts `/library`, `/wallet`, `/support` | Those screens exist; still rejects external URLs/schemes |
| `src/features/video/ProtectedVideoPlayer.tsx` | Position/play state carried across player re-creation; player error state with reload | `useVideoPlayer` creates a **new** player whenever the source changes; the backend rotates the ticket (new signed manifest URL) before expiry, so the lesson jumped to 0:00 and paused every few minutes; a CDN/decoder error left an endless spinner |
| `src/features/video/usePlaybackTicket.ts` | Rotation timer computed from `expiresAt` | After a non-rotating heartbeat the old timer could fire after the URL expired |
| `src/services/support.ts` | Links opened directly (no `canOpenURL` gate); `openLegal()` | On Android 11+ `canOpenURL('tel:'/'mailto:')` is false without manifest queries → phone/email support (the only password-recovery path) silently did nothing |
| `src/app/settings/about.tsx` | Privacy/Terms open the configured URLs (support fallback) | Previously both opened an email |
| `src/app/settings/language.tsx`, `src/components/layout/LanguageToggle.tsx` | Restart after direction change uses `reloadAppAsync` | `Updates.reloadAsync` throws when expo-updates is disabled → half-mirrored layout after switching Arabic/English |
| `src/app/settings/index.tsx` | "Delete account" entry; removed dead `switchLanguage` | Store requirement; lint error |
| `src/api/query-client.ts` | Wallet and support caches not persisted to AsyncStorage | Personal financial/support records were written unencrypted to disk |
| `src/features/profile/avatar.ts` | No runtime photo-library permission request (system picker needs none) | Allows dropping storage/camera permissions; no full-library prompt |
| `.env.example` | Legal URLs, EAS env guidance | Documentation |

**New files:** `src/app/settings/delete-account.tsx`,
`__tests__/release-hardening.test.ts`, this document.

Unchanged by design: payment architecture, business rules, backend, dashboard,
Arabic/RTL, dark mode, video security posture.

---

## 4. Environment variables

All `EXPO_PUBLIC_*` values are compiled into the app and readable by anyone —
none of them may be a secret. No backend secret was found in the mobile code
or bundle.

| Variable | Where used | Public/Secret | Current status | Required manual action |
|---|---|---|---|---|
| `APP_VARIANT` | `app.config.ts`, security plugin | Public | Set per profile in `eas.json` | None |
| `EXPO_PUBLIC_ENV` | `config/env.ts` (mocks off in prod, log level) | Public | Set per profile in `eas.json` | None |
| `EXPO_PUBLIC_API_URL` | `api/client.ts` base URL | Public | **Not set for production/staging** (placeholder removed); build refuses without it | Create in EAS env `production` (and `preview`): `https://<your-api-host>/api/v1` |
| `EXPO_PUBLIC_USE_MOCKS` | `config/env.ts` | Public | `false` in all profiles; forced off in prod | None |
| `EXPO_PUBLIC_API_TIMEOUT` | client timeout | Public | Default 20000 | Optional |
| `EXPO_PUBLIC_SUPPORT_PHONE` / `_WHATSAPP` / `_EMAIL` | support links, About | Public | **Not set**; code default is a placeholder; prod build refuses placeholders | Create in EAS env `production` with the real contacts |
| `EXPO_PUBLIC_ENABLE_DRM` | player | Public | Default false | Only when a license server exists |
| `EXPO_PUBLIC_ENABLE_ROOT_DETECTION` | device integrity signal | Public | Default true | None |
| `EXPO_PUBLIC_ENABLE_QUERY_PERSISTENCE` | cache persistence | Public | Default true | None |
| `EXPO_PUBLIC_PLAYBACK_TICKET_TTL` | informational | Public | Default 300 | Match backend if you change it |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | About screen | Public | Not set (falls back to email) | Set to your published privacy-policy page |
| `EXPO_PUBLIC_TERMS_URL` | About screen | Public | Not set | Set to your terms page |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Delete-account screen | Public | Not set | Set to a web page for deletion requests (also needed in Play Data safety) |
| `EAS_PROJECT_ID` | `app.config.ts` → `extra.eas.projectId`, OTA URL | Public | Not set (no fake fallback) | Run `eas init`, then paste the id as the fallback in `app.config.ts` **or** set it in EAS env for every environment |
| `EXPO_UPDATES_URL` | OTA override | Public | Derived automatically | None |

Backend-only (must never be added to the app): `JWT_*`, `MEDIA_SIGNING_KEY`,
`R2_*`, `DATABASE_URL`, `REDIS_*`, `PAYMOB_*`, `STRIPE_*`, `EXPO_ACCESS_TOKEN`,
Play Integrity keys. Confirm `PUBLIC_API_URL` and `MEDIA_CDN_BASE_URL` in the
backend's production environment are public HTTPS hosts — the ticket's
`manifestUrl` is built from them.

---

## 5. Architecture facts established from the code

- Expo SDK 57.0.20, React Native 0.86.3, React 19.2.3, expo-router 57, Hermes,
  New Architecture on, TypeScript strict. Native folders are generated
  (CNG / `expo prebuild`); a local Expo module `modules/content-protection`
  (FLAG_SECURE, capture/recording detection, iOS secure surface).
- Auth: phone + password; access/refresh tokens in Keychain/Keystore
  (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); single-flight refresh with rotating
  refresh tokens; device binding headers (`X-Device-Id` derived from a
  keystore secret + ANDROID_ID / IDFV + model).
- Video: `POST /playback/videos/:id/ticket` → signed HLS master URL (HMAC,
  verified by the Cloudflare Worker / API origin), watermark payload,
  heartbeats, rotation, release on unmount. No MP4 or download path in the
  app. No signing secret in the app.
- Push: Expo push service (`getExpoPushTokenAsync`), channels `default`,
  `content`, `account` (match the backend's `channelFor`), routes validated
  on both backend and app.
- Storage: tokens/device secret in SecureStore; preferences + progress queue
  in MMKV; non-sensitive query cache in AsyncStorage (24 h).

---

## 6. Android

| Item | Value |
|---|---|
| Package | `com.eduplatform.app` (dev `.dev`, staging `.stg`) |
| Version / versionCode | `1.0.0` / managed remotely by EAS (`appVersionSource: remote`, `autoIncrement`) |
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 |
| ABIs | armeabi-v7a, arm64-v8a, x86, x86_64 (AAB splits per device) |
| Signing | Not configured yet — EAS-managed keystore recommended; Play App Signing |
| Build | JS bundle verified; native AAB not built here |

Google Play currently requires **target API 36** for new apps and updates
(since 31 Aug 2026) — compliant.

**Permissions in the generated manifest (after fixes):**

| Permission | Why | Needed | Play declaration |
|---|---|---|---|
| INTERNET | API, HLS | Yes | No |
| ACCESS_NETWORK_STATE | offline detection | Yes | No |
| POST_NOTIFICATIONS | push (asked after sign-in) | Yes | No |
| DETECT_SCREEN_CAPTURE | screenshot callback (API 34+) | Yes (content protection) | No |
| DETECT_SCREEN_RECORDING | recording callback (API 35+) | Yes (content protection) | No |
| VIBRATE | notification channels | Yes | No |
| RECEIVE_BOOT_COMPLETED (from expo-notifications) | keeps scheduled notifications | Library default | No |
| CAMERA, RECORD_AUDIO, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE | — | **Removed** (`tools:node="remove"`) | — |

Other: `allowBackup=false`, data-extraction rules exclude everything,
cleartext off, system CAs only in release, `FLAG_SECURE` on the main window.

**Google Play blockers / risks:** payment policy (§9), account deletion web
URL for Data safety, privacy policy URL, reviewer access (§9), 12-tester
closed test if your developer account is a personal account created after
Nov 2023.

---

## 7. iOS

| Item | Value |
|---|---|
| Bundle ID | `com.eduplatform.app` |
| Version / build | `1.0.0` / managed remotely by EAS |
| Deployment target | iOS 16.4 |
| Devices | iPhone + iPad (`supportsTablet: true` → iPad screenshots required) |
| Capabilities | Push Notifications (aps-environment; EAS sets production for store builds) |
| Background modes | `remote-notification` |
| Usage strings | `NSPhotoLibraryUsageDescription` only |
| ATS | no arbitrary loads; local networking off in production |
| Encryption | `ITSAppUsesNonExemptEncryption = false` |
| Privacy manifest | generated (FileTimestamp C617.1, UserDefaults CA92.1, SystemBootTime 35F9.1, no tracking) + aggregated library manifests |
| URL scheme | `eduplatform` (no universal links / associated domains configured) |
| Signing | Not configured — EAS-managed recommended |
| Build | JS bundle verified; Xcode build not run here. Apple requires Xcode 26 / iOS 26 SDK — EAS picks a compliant image for SDK 57 |

**App Store blockers / risks:** payment policy 3.1.1 (§9), account deletion
(5.1.1(v)), reviewer demo account + device binding, privacy policy URL, iPad
screenshots, age-rating questionnaire.

---

## 8. Privacy / data inventory (derived from code)

**Collected from the user and sent to the backend**
- Full name, phone number, password (login/registration only; never stored on
  device), gender, university/faculty/department/academic year.
- Profile photo (optional, user-chosen) — uploaded to object storage via a
  presigned URL.
- Support ticket subjects/messages; account-deletion request.
- Access-card and recharge-card codes; library purchases (wallet credit).
- Search queries; notification read state.
- Learning activity: watch position, watched seconds, lesson completion,
  playback heartbeats with protection posture (secure surface / recording /
  external display).
- Security events: screenshot / recording detection with course/lesson ids.

**Device data sent on every request (headers)**
- Derived device id (SHA-256 of keystore secret + ANDROID_ID/IDFV + model),
  device name, model, manufacturer, OS version, app version/build, integrity
  flag (root/emulator heuristic), UI language.

**Stored on the device**
- Keychain/Keystore: access token, refresh token, user snapshot (name, phone,
  etc.), device secret + id.
- MMKV: theme, language, playback prefs, recent searches, offline progress
  queue, push token, last handled notification id.
- AsyncStorage: cached API responses for up to 24 h (courses, lessons meta,
  home, library, notifications, profile-derived lists) — **not** playback,
  attachments, auth, wallet or support.
- Nothing is backed up (backup disabled / excluded).

**Received from the backend**: course catalog, enrollment state, lessons,
signed short-lived HLS/document URLs, watermark text (name + id), wallet
balance/transactions, library items, notifications, support threads.

**Third parties**
- Expo push service (push token + project id; notification content passes
  through Expo → FCM/APNs).
- Google FCM / Apple APNs (delivery).
- Cloudflare (R2 / Worker) for media and avatar upload.
- WhatsApp / phone dialer / email app — only when the student taps support;
  the WhatsApp message is prefilled with reason and app version.
- No analytics, advertising, crash-reporting or tracking SDK is present.
  Fonts are bundled (no runtime Google Fonts call).

---

## 9. Store compliance — what applies to this app

**Payments (highest risk, not changed — your decision).**
- *Courses / course parts unlocked by access cards bought offline* — Apple
  3.1.1 disallows "license keys"/codes as an unlock mechanism for digital
  content unless the content is also offered via In-App Purchase; the
  "reader app" exception (3.1.3(a)) covers accessing previously purchased
  video content but forbids in-app purchasing/steering. Google Play allows
  consuming content bought elsewhere, but in-app sales of digital goods must
  use Play Billing.
- *Library bought in-app with wallet credit* — an in-app purchase of digital
  content with a non-store currency. Likely rejection on both stores.
- *`PAYMENT` enrollment method* — backend can return it per course and the app
  opens an external Paymob checkout. That is external payment steering for
  digital content (both stores). Business rules say courses are card-only:
  make sure **no course has `PAYMENT` enabled** in the dashboard, or ask for a
  mobile-side hide.
- Options to discuss (not implemented): reader-app posture on iOS (redeem
  only, no in-app library purchase, no prices/checkout), IAP/Play Billing for
  library, or regional alternative-billing programs.

**Account deletion.** Now initiated in-app (Settings → Account → Delete
account → support ticket). Recommended backend addition: a self-service
`DELETE /auth/account` (or `POST /profile/deletion-request`) that actually
deletes/anonymises (the admin endpoint is a soft delete). Google Play also
needs a public web URL for deletion requests.

**Reviewer access.** Provide a student demo account with enrolled courses,
wallet credit and at least one playable video. Device binding will lock
reviewers to one device — raise the device limit or disable binding for that
account. Content protection blocks screenshots; say so in review notes.

**Privacy policy** must be public HTTPS, in-app (About) and in both consoles,
covering the inventory in §8.

**Age rating / audience.** Educational, user-generated support messages only;
no ads. Target audience likely 18+ (university students) — confirm; if you
include under-13s, Families policy applies.

---

## 10. Manual actions required

| # | Where | What | Value | Destination | Public/Secret | Platform |
|---|---|---|---|---|---|---|
| 1 | Terminal | `npm ci` then `npx expo-doctor` | — | — | — | both |
| 2 | expo.dev / terminal | `eas login`, `eas init` | EAS project id | `app.config.ts` fallback for `EAS_PROJECT_ID` or EAS env var in every environment | Public | both |
| 3 | EAS env vars (`production`, `preview`) | `EXPO_PUBLIC_API_URL` | your HTTPS API base incl. `/api/v1` | EAS environment | Public | both |
| 4 | EAS env vars | `EXPO_PUBLIC_SUPPORT_PHONE`, `_WHATSAPP`, `_EMAIL` | real contacts | EAS environment | Public | both |
| 5 | EAS env vars | `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `_TERMS_URL`, `_ACCOUNT_DELETION_URL` | your published pages | EAS environment | Public | both |
| 6 | Backend prod env | `PUBLIC_API_URL`, `MEDIA_CDN_BASE_URL`, `MEDIA_SIGNING_KEY`, `EXPO_ACCESS_TOKEN`, `PUSH_PROVIDER=expo` | your values | backend host | URLs public, keys **secret** | both |
| 7 | Firebase console | Android app `com.eduplatform.app`; FCM V1 service-account key | JSON key | `eas credentials -p android` → FCM V1 | **Secret** | Android |
| 8 | Apple Developer | APNs key (.p8) | key + Key ID + Team ID | `eas credentials -p ios` → Push | **Secret** | iOS |
| 9 | EAS | Android keystore (EAS-generated) — download a backup | keystore + passwords | password manager | **Secret** | Android |
| 10 | Apple Developer / EAS | distribution cert + provisioning (EAS-managed) | — | EAS | **Secret** | iOS |
| 11 | Play Console | create app, service account JSON | JSON key | `credentials/play-service-account.json` (gitignored) | **Secret** | Android |
| 12 | App Store Connect | create app | `ascAppId`, Apple ID, Team ID | `eas.json` → `submit.production.ios` (or answer prompts) | Public ids | iOS |
| 13 | Dashboard | ensure no course has `PAYMENT` method; decide payment posture (§9) | — | — | — | both |
| 14 | Backend (optional, recommended) | self-service account deletion endpoint | — | backend | — | both |
| 15 | Stores | privacy policy, screenshots (phone + 7"/10" tablet Android; iPhone 6.9"/6.5" + iPad 13"), feature graphic 1024×500, descriptions EN/AR | — | consoles | Public | both |
| 16 | Stores | reviewer demo account (device limit raised) | phone + password | App Access / Review Information | **Secret** (share only in console) | both |
| 17 | Stores | Data safety / App Privacy from §8 | — | consoles | — | both |

---

## 11. Google Play release guide

1. **Developer account** — play.google.com/console → sign up (organization
   account recommended; D-U-N-S needed). Complete identity verification.
2. **Play Console → Create app** — name *EduPlatform*, default language,
   App, Free, accept declarations.
3. **Identity** — the package is fixed at first upload:
   `com.eduplatform.app`. Never change it afterwards.
4. **Prepare the project**
   ```bash
   npm ci
   npx expo-doctor
   npm run typecheck && npm test
   npm i -g eas-cli
   eas login
   eas init                              # prints the project id → §10 #2
   eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<your-api-host>/api/v1 --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_PHONE --value <+20…> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_WHATSAPP --value <+20…> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_SUPPORT_EMAIL --value <support@your-domain> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value <https://…> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_TERMS_URL --value <https://…> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_ACCOUNT_DELETION_URL --value <https://…> --visibility plaintext
   ```
5. **Push** — Firebase → add Android app `com.eduplatform.app` → service
   accounts → generate key → `eas credentials -p android` → *Google Service
   Account Key for Push Notifications (FCM V1)* → upload.
6. **Signing** — `eas credentials -p android` → *Set up a new keystore* (let
   EAS generate) → then *Download keystore* and store it + passwords safely.
   Play App Signing is enabled automatically on first upload.
7. **Production AAB**
   ```bash
   eas build -p android --profile production
   ```
8. **Store listing** — app name, short (80) and full (4000) description in
   English and Arabic, app icon 512×512 PNG, feature graphic 1024×500, phone
   screenshots (min 2) + 7" and 10" tablet screenshots, category *Education*,
   contact email, **privacy policy URL**.
9. **App content** (Policy → App content):
   - Privacy policy URL.
   - **App access**: "All or some functionality is restricted" → add the demo
     phone + password and instructions (device binding raised for it).
   - Ads: *No*.
   - Content rating: IARC questionnaire (Education; no violence etc.).
   - Target audience: choose the real age groups (likely 18+).
   - **Data safety**: use §8 — collected: name, phone, user IDs, photos
     (optional), app interactions, in-app search history, other user content
     (support messages), device or other IDs, purchase history; encrypted in
     transit: yes; deletion: yes → give `EXPO_PUBLIC_ACCOUNT_DELETION_URL`.
     Shared: none for advertising; processors (Expo/Cloudflare) are service
     providers.
   - Financial features / government / news: *No*.
   - **Account deletion**: provide the web URL.
10. **Internal testing** — Testing → Internal testing → create track, add
    testers (email list). Upload:
    ```bash
    eas submit -p android --profile production --latest
    ```
    (first time you may need to upload the AAB manually in the console;
    `submit.production.android` uses `track: internal`, `releaseStatus: draft`
    → roll out the draft in the console).
11. **Install & test** — open the tester opt-in link on a real phone, install
    from Play, test: login, registration, device binding, course redeem,
    video playback for >5 min (ticket rotation — position must continue),
    screenshot blocked, push (foreground/background/killed, tap → correct
    screen), logout (no pushes after), Arabic ↔ English restart, dark mode,
    offline banner vs "server unreachable", delete-account request.
12. **Fix issues** — rebuild (`autoIncrement` bumps versionCode) and resubmit
    to internal.
13. **Closed testing (if personal account created after Nov 2023)** — run a
    closed test with ≥12 testers opted in for 14 continuous days, then apply
    for production access in the Dashboard.
14. **Production release** — Production → Create release → promote the
    tested build (or `eas submit` with `track: production`), release notes EN
    / AR, countries (Egypt + others).
15. **Review** — send for review (Publishing overview). Typical 1–7 days;
    answer policy emails in the Inbox.
16. **Publication** — once approved, publish (or managed publishing). Monitor
    Android vitals and pre-launch reports (screenshots will be black because
    of FLAG_SECURE — expected).

---

## 12. Apple App Store release guide

1. **Apple Developer Program** — enroll (organization needs D-U-N-S); note
   the **Team ID**.
2. **Bundle ID** — Certificates, Identifiers & Profiles → Identifiers → App
   IDs → explicit `com.eduplatform.app` (EAS can also create it).
3. **Capabilities** — enable *Push Notifications*. No associated domains,
   Sign in with Apple or App Groups are used.
4. **APNs key** — Keys → + → Apple Push Notifications service → download
   `.p8` once; note Key ID.
5. **Certificates / provisioning** — let EAS manage:
   ```bash
   eas credentials -p ios      # distribution certificate + provisioning profile + push key
   ```
6. **EAS iOS credentials** — in the same menu upload the APNs key (or let EAS
   create one).
7. **App Store Connect → My Apps → + New App** — iOS, name *EduPlatform*,
   primary language, bundle id `com.eduplatform.app`, SKU. Note the numeric
   **Apple ID (ascAppId)**.
8. **Metadata** — subtitle, description EN/AR (add Arabic localization),
   keywords, support URL, marketing URL (optional), **privacy policy URL**,
   category *Education*, copyright.
9. **Screenshots** — iPhone 6.9" (and 6.5" if you want), and **iPad 13"**
   because `supportsTablet` is true (or set it to false before the first
   upload if iPad is not intended).
10. **App Privacy** — use §8: Contact info (name, phone), User content
    (photos, support messages), Identifiers (user id, device id), Usage data
    (product interaction), Purchases, Diagnostics none. Linked to user: yes.
    Tracking: **No**.
11. **Age rating** — answer the (2026) questionnaire honestly (education,
    user-generated messages to staff only).
12. **Review information** — demo phone + password (device limit raised),
    notes: content protection blocks screenshots/recording; access cards are
    sold offline by the institution; how to reach a playable lesson.
    Describe account deletion path (Settings → Account → Delete account).
13. **Production build**
    ```bash
    eas build -p ios --profile production
    ```
14. **Upload**
    ```bash
    eas submit -p ios --profile production --latest
    ```
    (answer the Apple ID / ascAppId / Team ID prompts, or add them to
    `eas.json` → `submit.production.ios`).
15. **TestFlight** — build appears after processing; answer export
    compliance (already declared: exempt). Add internal testers (App Store
    Connect users) and/or external testers (requires beta review).
16. **TestFlight testing** — same checklist as Android step 11, on physical
    iPhone and iPad; push only works on physical devices.
17. **Submit for review** — attach the build to the version, fill "What's
    New", answer the IDFA question (No), submit.
18. **App Review** — expect questions on 3.1.1 (payments) and 5.1.1(v)
    (deletion); reply in Resolution Center.
19. **Release** — manual or automatic release after approval; phased release
    optional.
