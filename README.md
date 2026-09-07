# EduPlatform — Student Mobile App

Production React Native (Expo) application for a university educational
platform. Phase 1 of the system: the student app. The NestJS backend and the
Next.js admin dashboard are separate projects that talk to the same API.

---

## What's in here

| Area | Implementation |
|---|---|
| Framework | React Native 0.76 · Expo SDK 52 · TypeScript (strict) · Expo Router v4 |
| Styling | NativeWind 4 + a semantic token layer (light **and** dark, orange/red/white/black identity) |
| Server state | TanStack Query 5 (+ disk persistence, with security-sensitive keys excluded) |
| Client state | Zustand (theme, language, player preferences, UI) |
| Forms | React Hook Form + Zod, i18n-keyed validation messages |
| Storage | `expo-secure-store` (Keychain/Keystore) for tokens & device secret · MMKV for preferences |
| i18n | i18next, full English + Arabic, real RTL handling |
| Video | HLS through short-lived server-issued playback tickets, DRM-ready (Widevine / FairPlay) |
| Content protection | Custom native Expo module: Android `FLAG_SECURE` + capture/recording callbacks, iOS capture-excluded rendering surface + `isCaptured` observation |

---

## Quick start

```bash
# 1. install
npm install

# 2. environment
cp .env.example .env.development     # already created; edit if needed

# 3. native project + dev client  (REQUIRED — see note below)
npx expo prebuild --clean
npx expo run:android      # or: npx expo run:ios
```

> **Expo Go will not work.** The screenshot / screen-recording protection is a
> native module. In Expo Go `capabilities.isSupported` is `false` and the app
> deliberately **refuses protected playback** rather than streaming lessons
> unprotected. Use a development build.

The app ships with a built-in mock backend so it runs before the API exists:

```
EXPO_PUBLIC_USE_MOCKS=true
```

Flip it to `false` and point `EXPO_PUBLIC_API_URL` at the NestJS server when
it's ready. Nothing in `src/features/**` knows the mock exists — it is wired in
at the transport boundary only (`src/api/client.ts`). Mocks are force-disabled
in production builds regardless of the variable.

### Mock credentials

Any phone number + any password of 8+ characters signs you in. Special numbers
exercise error paths:

| Phone | Result |
|---|---|
| `01000000000` | `ACCOUNT_DISABLED` |
| `01011111111` | `DEVICE_NOT_AUTHORIZED` |
| `01099999999` | `PHONE_ALREADY_REGISTERED` (on register) |

Mock access codes: `DSA1-2026-ABCD` (course c2), `SIG1-2026-WXYZ` (c1),
`MATH-2026-RENEW` (c6).

---

## Scripts

```bash
npm start            # dev client
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # jest
npm run prebuild     # regenerate ios/ + android/
npm run build:prod   # eas build --profile production
```

---

## Project structure

```
src/
├── app/                  Expo Router routes (file-based)
│   ├── (auth)/           login · register wizard · password help
│   ├── (tabs)/           home · courses · my courses · search · alerts · profile
│   ├── course/[courseId] course details, dynamic sections
│   ├── lesson/[lessonId] lesson overview (does NOT start playback)
│   ├── player/[videoId]  protected fullscreen player
│   ├── viewer/[id]       protected document viewer
│   └── settings/         theme · language · playback · notifications · security · devices
│
├── api/                  axios client, token refresh, error normalization,
│                         query client, endpoints, query keys, mock backend
├── components/
│   ├── ui/               design system primitives
│   ├── layout/           app bar, brand mark, section header
│   └── feedback/         network banner, privacy shield, toasts, error boundary
├── features/             auth · courses · lessons · video · enrollment ·
│                         home · search · notifications
├── services/             secure storage · MMKV · device identity ·
│                         content protection · notifications · support · logger
├── store/                zustand stores
├── hooks/ utils/ constants/ types/ theme/ i18n/ config/
│
modules/content-protection/   native Expo module (Kotlin + Swift) + config plugin
plugins/withSecurityHardening.js
docs/                         ARCHITECTURE · SECURITY · API_CONTRACT · MANUAL_STEPS
```

---

## Read next

- **[docs/MANUAL_STEPS.md](docs/MANUAL_STEPS.md)** — everything you must do by
  hand before this can build and ship. Start here.
- **[docs/SECURITY.md](docs/SECURITY.md)** — the content-protection design,
  what it does and does not guarantee.
- **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)** — every endpoint the app
  calls, with request/response shapes for the NestJS team.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the layers fit
  together and why.
