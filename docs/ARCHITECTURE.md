# Architecture

## Layering

```
                    ┌──────────────────────────────┐
   src/app/         │  Routes (Expo Router)        │  thin — composition only
                    └───────────────┬──────────────┘
                                    │
   src/features/    ┌───────────────┴──────────────┐
                    │  Feature modules             │  api · hooks · components
                    │  auth courses lessons video  │  schemas
                    │  enrollment search …         │
                    └───────────────┬──────────────┘
                                    │
   src/api/         ┌───────────────┴──────────────┐
                    │  Transport                   │  axios · refresh · retry
                    │                              │  error normalization
                    │                              │  ◄── mock adapter plugs in
                    └───────────────┬──────────────┘      here, and only here
                                    │
   src/services/    ┌───────────────┴──────────────┐
                    │  Platform                    │  secure storage · MMKV
                    │                              │  device identity
                    │                              │  content protection
                    │                              │  notifications · logger
                    └───────────────┬──────────────┘
                                    │
   modules/         ┌───────────────┴──────────────┐
                    │  Native (Kotlin / Swift)     │  FLAG_SECURE · capture
                    │                              │  detection · secure surface
                    └──────────────────────────────┘
```

Rules that keep this honest:

- **Routes contain no business logic.** They compose feature components and
  handle navigation. Anything reusable moves down a layer.
- **Features never import each other's internals.** They talk through exported
  hooks. `video` depends on `lessons`' types, not its components.
- **Only `src/api/client.ts` knows the mock backend exists.** Deleting
  `src/api/mock/` and the two references to it removes mocking entirely.
- **Only `src/services/` touches native modules.** Features consume hooks.

---

## State: two systems, clear boundary

**Server state → TanStack Query.** Anything the backend owns: courses,
lessons, progress, notifications, profile, devices. Query keys are centralized
in `src/api/query-keys.ts` as hierarchical arrays, so
`invalidateQueries({ queryKey: qk.courses.all })` clears everything
course-derived in one call.

**Client state → Zustand.** Theme, language, player preferences, transient UI.
Four small stores instead of one global one, so a toast doesn't re-render the
player.

Deliberate exception: **playback tickets are neither.** They live in component
state inside `usePlaybackTicket`, because they expire, are tied to a
server-side concurrency slot, and must never be written to disk. They're also
on the query-persistence deny-list as defence in depth.

### Cache persistence

The query cache is persisted to AsyncStorage so a cold start opens to real
content instead of skeletons. `NEVER_PERSIST` excludes `playback`,
`attachments` and `auth` roots. The cache is busted by app version + env, and
wiped entirely on logout.

---

## Error handling

Everything that can fail produces an `ApiError` with a machine-readable `code`:

```
axios error ──┐
mock throw  ──┼──► toApiError() ──► ApiError { code, status, retryable, … }
unknown     ──┘                          │
                                         ├─► ErrorState / InlineError
                                         │     renders t(`errors.${code}`)
                                         └─► retry policy (retryable only)
```

Three consequences:

1. **No screen inspects an HTTP status.** They branch on `code`.
2. **Students never see a server message.** `message` is developer text, shown
   only in dev builds. Every user-facing string comes from the i18n bundle in
   both languages.
3. **Non-retryable errors are not retried.** A 403 device denial or a 402
   payment requirement is a decision, not a fault; retrying burns battery and
   confuses people.

`SESSION_ENDING` codes broadcast through `onSessionEnded`, which the
`AuthProvider` uses to tear the session down exactly once from anywhere in the
app — including a background refetch.

---

## Theming

Colors are declared **once**, as CSS variables in `src/theme/global.css`, and
exposed two ways:

- **NativeWind classes** (`bg-surface`, `text-muted`) — the default.
- **`useTheme().colors`** — raw hex, for the places a className can't reach:
  the native status/nav bar, React Navigation, SVG, the video chrome.

`src/theme/palette.ts` mirrors the CSS variables; a test asserts the two stay
in sync.

Light and dark are **two designed palettes, not an inversion**. Concretely:
primary lifts from `brand-600` to `brand-400` in dark mode to hold AA contrast
against `#14141A`; depth comes from shadows in light mode and from a lighter
surface tone in dark mode (shadows are invisible on near-black), which is why
`Card`'s `elevated` prop swaps the background rather than the shadow.

`ThemeProvider` syncs all four consumers (NativeWind, React Navigation, the
native root view, the system bars) in one effect, so there's no frame where the
app is half light and half dark.

---

## Internationalization and RTL

`i18next` with two complete bundles. No user-facing string is hardcoded outside
`ErrorBoundary` — deliberately, since calling into i18n from the handler that
catches an i18n crash would loop.

Layout direction is the hard part. React Native's RTL is a **native** setting
that only fully applies after a bundle reload, so:

- The app always keeps `I18nManager` in sync and **tells the caller whether a
  reload is required**, so the UI offers "restart now" instead of rendering a
  half-mirrored screen.
- Components use **logical** utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`,
  `text-start`, `inset-*`), which flip automatically.
- `src/i18n/direction.ts` handles the cases styles can't express: icon glyph
  choice, animation vectors, gesture direction.

**The video timeline never mirrors.** Media time flows left→right in every
locale, so the scrubber, its labels and the ±10s buttons keep their physical
arrangement in Arabic — only the text is localized. This matches every major
player and is enforced by `NEVER_MIRROR` in `Icon.tsx` plus an explicit
`direction: 'ltr'` on the transport row.

Arabic also gets its own font family with different metrics, set once in the
`Text` primitive. Arabic plural rules (zero/one/two/few/many/other) are used
properly in the bundle.

---

## Performance

- **FlashList** for every long list (catalogue, my courses, notifications),
  with measured `estimatedItemSize`.
- **Infinite queries** paginating on `meta.hasNext`.
- **`expo-image`** with `memory-disk` caching for thumbnails.
- **Skeletons pulse opacity**, not a masked gradient — one animated value per
  node matters when a dozen mount at once on a low-end Android.
- **Progress writes are throttled** to an interval-or-delta, cutting a
  one-hour lesson from hundreds of writes to a few dozen.
- **Selector-based Zustand reads** so unrelated state changes don't re-render.
- The heartbeat and watermark timers stop when the player unmounts or pauses.

---

## Accessibility

- 48dp minimum touch targets (`MIN_TOUCH_TARGET`, applied in `Button`,
  `IconButton`, `ListItem`, `Select`, `LessonRow`).
- Every interactive element has a role, a label, and state
  (`disabled` / `busy` / `selected` / `expanded`).
- Font scaling is respected with a per-variant `maxFontSizeMultiplier` cap so
  large-text users get bigger text without broken layouts.
- Error states use `accessibilityRole="alert"`; the offline banner uses
  `accessibilityLiveRegion="polite"`.
- Composite rows expose one combined label (`"Lesson 3: Convolution, 18m,
  completed"`) instead of five separate nodes.
- Decorative icons are `accessible={false}`.
- Contrast: every semantic pair meets WCAG AA in both themes.

---

## Testing

`jest-expo` with mocks for MMKV, SecureStore and the native protection module
in `jest.setup.js`. The tests included cover the parts where a regression is
silent rather than loud: theme token parity, error-code mapping, phone/name
validation, RTL direction helpers, and the contiguous-watch progress logic.
Add screen-level tests with `@testing-library/react-native` as features settle.

---

## Extending

**A new screen:** add a file under `src/app/`. Expo Router picks it up; add it
to the `Stack` in `_layout.tsx` only if it needs non-default presentation.

**A new API resource:** endpoint in `src/api/endpoints.ts`, key in
`query-keys.ts`, typed functions in `features/<x>/api.ts`, hooks in
`features/<x>/hooks.ts`. Nothing else changes.

**A new language:** add `src/i18n/locales/<code>.json`, register it in
`src/i18n/index.ts`, add the code to `SUPPORTED_LANGUAGES`, and to
`RTL_LANGUAGES` if applicable. Nothing else is language-aware.

**A new error code:** add it to `ApiErrorCode`, to `KNOWN_CODES` in
`errors.ts`, and to the `errors.*` block in both locale files. The UI picks it
up automatically.
