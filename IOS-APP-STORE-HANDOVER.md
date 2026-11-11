# Student Center — iOS App Store handover

For the developer who will build, sign and submit the iOS app with **their own
Apple Developer account**. Everything that does not need an Apple account has
been done and verified. Everything that does is listed here, in order.

> No passwords, tokens, private keys or student credentials appear in this
> document or in the repository. You will be given what you need separately.

---

## 1. Repository

https://github.com/youssef-hamed04/mobile-app-student

## 2. Release commit

Build from the tag **`ios-handover-1.0.0`** on `main`. The exact commit SHA
behind the tag is recorded in the owner's readiness report
(`STUDENT-CENTER-IOS-GITHUB-RELEASE-READINESS.md`). Check it after cloning:

```bash
git rev-parse ios-handover-1.0.0^{commit}
```

## 3. Clone

```bash
git clone https://github.com/youssef-hamed04/mobile-app-student.git
cd mobile-app-student
git checkout ios-handover-1.0.0
```

There are no submodules and no files outside the repository are needed to
build for iOS.

## 4. Tooling

| Tool | Version |
|---|---|
| Node.js | 20 or newer (`package.json` engines); verified with **Node 24.12** |
| npm | lockfile v3; verified with **npm 11.6** |
| EAS CLI | **16 or newer** (`eas.json`); verified with 27.7.2 — `npm i -g eas-cli` or `npx eas-cli@latest` |
| Expo SDK | 57 (React Native 0.86.3, New Architecture only) — do not upgrade for this release |
| Xcode | only if you build locally; EAS builds use Expo's macOS image for SDK 57 |

## 5. Install

```bash
npm ci
npx tsc --noEmit
npx jest --ci
```

Expected: typecheck clean and **575 tests passing** (the same under
`npx jest --ci -c jest.android.config.js`). `npx eslint .` reports 24
pre-existing React Compiler advisory errors in the video player and a few
hooks; the project does not enable the React Compiler and they do not affect
the build. `npx expo install --check` lists patch-level updates within SDK 57;
they were reviewed and deliberately not applied so iOS ships the same
dependency set as the tested Android build.

## 6. Environment variables

Store builds do **not** read `.env` files. They come from two places:

**a) `eas.json` → `build.production.env` (committed, public):**
`APP_VARIANT=production`, `EXPO_PUBLIC_ENV=production`,
`EXPO_PUBLIC_API_URL` (the production API), `EXPO_PUBLIC_USE_MOCKS=false`,
`EXPO_PUBLIC_ENABLE_LIBRARY=true` and the four commercial flags `=false`.
The commercial features are also forced off in code
(`src/config/release-features.ts`), whatever any variable says.

**b) The EAS project's "production" environment (set by the owner):**

| Name | Used for |
|---|---|
| `EAS_PROJECT_ID` | Expo project id (public) |
| `EXPO_PUBLIC_API_URL` | production API (also in `eas.json`) |
| `EXPO_PUBLIC_SUPPORT_PHONE`, `EXPO_PUBLIC_SUPPORT_WHATSAPP`, `EXPO_PUBLIC_SUPPORT_EMAIL` | contact buttons (password help, support) |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | About screen and account deletion |
| `GOOGLE_SERVICES_JSON` (secret file) | **Android only** — iOS does not use Firebase |

`app.config.ts` refuses a production build on the EAS worker if the API URL
is missing, not `https`, local or a placeholder, if mocks are on, or if any
support contact or legal URL is missing or a placeholder. A refused build
prints exactly which value is wrong.

## 7. Expo / EAS project ownership — decide this first

The app is the EAS project **`@startuppp3/edu-platform-mobile`** (id
`f5f88e33-01f3-4049-ae16-6c3cd5221f57`, owned by the owner's Expo account).
Three things depend on building **inside this project**:

1. **Push notifications.** The app registers an Expo push token for this
   project id and the backend sends through Expo's push service. Tokens from
   a different project would not be delivered by the current backend set-up.
2. **The production environment variables** in section 6b live here.
3. **OTA updates** (`expo-updates`, channel `production`, runtime = app
   version) and the **remote build number** (`appVersionSource: remote`).

**Recommended:** the owner gives you access to this project — Expo personal
accounts cannot add members, so the owner either moves the project into an
Expo organization they own (the account already has one) and invites you,
or runs the build step themselves once your Apple credentials are stored on
the project. Your Apple credentials are stored on the Expo project, not in
the repository.

**Not recommended:** building under your own Expo account. You would set
`EAS_PROJECT_ID` to your project, recreate every variable in 6b, and the
backend's push delivery and the OTA channel would then point at two
different projects for Android and iOS.

## 8. Apple Developer account

- A paid Apple Developer Program membership. An **organization** membership
  is strongly advised for an education business (it shows the company as the
  seller and is what App Review expects for a service with accounts).
- Your role must allow creating identifiers, certificates and App Store
  Connect apps (Account Holder or Admin; App Manager for App Store Connect).
- The latest Program License Agreement accepted. The app is free with no
  in-app purchase, so the Paid Apps agreement is not needed.

## 9. Apple team selection

`eas build` / `eas credentials` sign in to Apple with your Apple ID and ask
which team to use. **No Team ID is hard-coded anywhere** in this repository;
the generated Xcode project has no `DEVELOPMENT_TEAM`. Pick your team there.

## 10. Bundle identifier

| Variant | iOS bundle id |
|---|---|
| production | **`com.studentcenter.app`** |
| staging / development | `com.studentcenter.app.stg` / `.dev` (not needed for the store) |

The same id is the **Android package** of the app already prepared for Google
Play — do not change it for Android. It is not used by any live App Store app
(public lookup, 11 November 2026), but only your Apple account can confirm it
is free to register. If Apple refuses it because another team owns it:

1. Agree a new iOS id with the owner (for example `com.<company>.studentcenter`).
2. In `app.config.ts`, give iOS its own map instead of `BUNDLE_ID[VARIANT]`
   (keep `android.package` unchanged) and update the identity test in
   `__tests__/release-features.test.ts`.
3. Nothing else references the iOS id: there are no associated domains,
   no App Groups, no iOS Firebase app and no keychain sharing.

## 11. Signing certificate and provisioning profile

Let EAS manage them:

```bash
npx eas-cli@latest credentials -p ios
```

Choose the **production** build profile, sign in to Apple, then let EAS create
(or reuse) an **Apple Distribution certificate** and an **App Store
provisioning profile** for `com.studentcenter.app`. EAS registers the bundle id
and enables the **Push Notifications** capability. If you prefer to bring
your own `.p12` and `.mobileprovision`, upload them through the same menu —
never commit them (`.gitignore` already blocks `*.p12`, `*.mobileprovision`,
`*.p8`, `credentials/`).

## 12. Push notifications (APNs)

- In `eas credentials -p ios`, add an **APNs key** (`.p8`, "Push Notifications:
  Manage your Apple Push Notifications Key"). Expo's push service uses it to
  deliver to iOS devices for this project.
- The generated entitlements contain `aps-environment = development`; App
  Store builds take the production value from the App Store provisioning
  profile. Confirm it in the IPA (section 15).
- The app asks for notification permission only when the student opts in
  (Notifications tab or Settings), never at launch.
- Background mode `remote-notification` is declared; no silent pushes are used.

## 13. Firebase

**Not required for iOS.** There is no `GoogleService-Info.plist` and no iOS
Firebase app. Firebase (`google-services.json`) is used for Android only.

## 14. Build

Compile check without signing (optional, no Apple account needed):

```bash
npx eas-cli@latest build -p ios --profile production:ios-simulator
```

Store build:

```bash
npx eas-cli@latest build -p ios --profile production
```

- Version **1.0.0** (`app.config.ts`). The **build number is remote** and
  auto-incremented by EAS: the iOS counter was initialized at 1 on
  11 November 2026, so the first store build will be **2**. Ignore the
  `ios.buildNumber: '1'` in `app.config.ts` (EAS warns about it).
- Minimum iOS **16.4**. Devices: iPhone **and iPad** (`supportsTablet: true`) —
  see section 22 for the iPad decision.
- Do not run `expo prebuild` and commit an `ios/` folder: the project is
  managed, and `/ios` is ignored on purpose.

## 15. IPA verification

Download the `.ipa` from the EAS build page, unzip it, then on a Mac:

```bash
unzip -q StudentCenter.ipa -d ipa
plutil -p ipa/Payload/*.app/Info.plist | grep -E 'CFBundleIdentifier|CFBundleShortVersionString|CFBundleVersion|CFBundleDisplayName|ITSAppUsesNonExemptEncryption|NSPhotoLibraryUsageDescription|NSCamera|NSMicrophone|NSFaceID|NSAllowsArbitraryLoads'
codesign -d --entitlements :- ipa/Payload/*.app | grep -A1 aps-environment
ls ipa/Payload/*.app/PrivacyInfo.xcprivacy ipa/Payload/*.app/ar.lproj
```

Expected: `com.studentcenter.app`, `1.0.0`, your build number, display name
**Student Center**, `ITSAppUsesNonExemptEncryption = false`, the photo-library
string only (no camera, microphone or Face ID strings), no arbitrary loads,
`aps-environment = production`, a privacy manifest, and Arabic strings.

## 16. TestFlight

```bash
npx eas-cli@latest submit -p ios --profile production --latest
```

`eas.json` has an empty `submit.production.ios` block, so the CLI asks for the
App Store Connect app; add `"ascAppId": "<your app's Apple ID>"` there (it is
not a secret) to make it non-interactive. Transporter also works. Then add
internal testers in TestFlight and run the device checklist in section 21
before any review submission.

## 17. App Store Connect app record

Create the app with: platform iOS, name (see `APP-STORE-LISTING-DRAFT.md`;
names are unique across the store, so have an alternative), primary language,
bundle id `com.studentcenter.app`, and an SKU of your choice. Price **free**,
no in-app purchases. Category: **Education**. Choose the storefronts the owner
wants (the service targets Egypt).

## 18. App privacy and encryption

- **Encryption:** `ITSAppUsesNonExemptEncryption = false` (standard HTTPS/TLS
  only). App Store Connect will not ask export questions for each build.
- **App Privacy** (nutrition labels): a draft mapping from the app's real data
  collection is in `APP-STORE-LISTING-DRAFT.md`. The owner must confirm it.
  Nothing is used for tracking; there is no advertising identifier.
- **Privacy policy URL:** the app's production value of
  `EXPO_PUBLIC_PRIVACY_POLICY_URL`. Its wording must match the iOS app — see
  the owner's readiness report.

## 19. Review account

App Review needs a working sign-in (guideline 2.1). Prepare, with the owner:

- A dedicated student account (phone number + password) with **at least one
  course active** that contains a playable video, and library access with a
  readable document.
- **Device binding:** every account is bound to one device. The first device
  of an account with no active device is bound automatically. So **do not sign
  in to the review account on your own phone before submitting** — or ask the
  administration to remove its devices first. If Apple tests on a second
  device (for example an iPad), it will wait for approval: tell the
  administration the review window so they can approve it promptly.
- The backend (production API) must be up during review.
- Put the credentials only in App Store Connect → App Review Information,
  never in the repository. Use the review notes in `APP-STORE-LISTING-DRAFT.md`.

## 20. Submission

1. TestFlight build passes the section 21 checks.
2. Fill the version page: screenshots in the iPhone size App Store Connect
   requires (and the iPad size too while iPad is supported), description,
   keywords, support URL, privacy URL, age rating, App Privacy, review
   information.
3. Select the build and submit for review. Release manually unless the owner
   asks otherwise.

## 21. Checks that need a real iPhone (and iPad)

Not verifiable without hardware; do them on a TestFlight build:

1. **FairPlay playback (Gumlet):** a normal lesson video plays. The production
   assets carry FairPlay keys and Gumlet's FairPlay certificate is DER, but the
   licence exchange itself has never been exercised on a device.
2. **Mobile HLS playback** on a video that has a mobile rendition, and
   seamless continuation past a ticket rotation (about every 5 minutes).
3. **Screen protection:** take a screenshot and a Control Center recording
   while a video and while a PDF is open — the protected area should come out
   blank (secure-surface hosting was fixed for the New Architecture in this
   release and is compiled, but never observed on hardware). Mirroring/
   recording must raise the full-screen shield.
4. **Touches inside protected views:** player controls, seeking, speed sheet,
   and PDF scrolling/zoom all respond.
5. Course attachment PDFs open (this viewer was blank on iOS before this
   release) and library documents open; a 100+ page PDF on an older iPhone.
6. Fullscreen and rotation on iPhone; on iPad, Split View / Slide Over.
7. Push notification received and tapping it opens the right screen.
8. Arabic: right-to-left layout after the language switch, the Arabic photo
   permission prompt, and the "Protected content" app-switcher overlay text.
9. Account deletion request, sign-out, and "Cancel deletion" from the login screen.
10. Pending-device behaviour on a second device.

## 22. Common problems, versioning and rollback

| Symptom | Cause / fix |
|---|---|
| `Production build refused — …` in the EAS log | an EAS production variable is missing or a placeholder (section 6) |
| Bundle id not available | section 10 |
| Push token request fails / no pushes | APNs key not added to the Expo project, or building under another project (sections 7, 12) |
| `aps-environment` is `development` in the IPA | built with a development/ad-hoc profile — use the App Store profile |
| Rejected under 3.1.1 / 3.1.3 (purchases outside the app) | see the owner's readiness report: the app sells nothing and links to no purchase; reply with the review notes, do not add links |
| Rejected under 4.2 (minimum functionality) | point to native protected playback, watch progress and "continue watching", push notifications, the protected PDF reader, Arabic/English with RTL |
| iPad layout rejected | owner decision: keep iPad and fix, or set `ios.supportsTablet: false` for this version (removes iPad from sale; needs a new build) |

- **Versioning:** keep `version` in `app.config.ts` as the marketing version
  (1.0.0 now). Build numbers come from EAS. A new store version for a native
  change means bumping `version` (which also moves the OTA runtime).
- **OTA updates:** the iOS build follows the `production` channel with
  runtime `appVersion`. An update published to that channel for runtime
  1.0.0 reaches installed iOS apps — coordinate with the owner before
  publishing anything.
- **Rollback:** App Store releases cannot be pulled back to an older binary.
  Use phased release, keep the previous build in TestFlight, fix forward with a
  new build, or (JS-only problems) publish a corrective OTA update to the
  `production` channel for the same runtime.

## What cannot happen until your Apple account is connected

Bundle id registration, distribution certificate, provisioning profile, APNs
key, the signed `.ipa`, TestFlight, the App Store Connect record, App Privacy,
review submission — and every hardware check in section 21.
