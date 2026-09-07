# API contract

Everything the mobile app calls. Written for the NestJS team.

Base URL: `EXPO_PUBLIC_API_URL` (must include the version segment, e.g.
`https://api.example.com/api/v1`).

---

## Conventions

**Envelope.** Success responses are `{ "data": <payload> }`. A bare payload is
tolerated by the client but the envelope is preferred.

**Errors.**

```json
{
  "statusCode": 403,
  "code": "DEVICE_NOT_AUTHORIZED",
  "message": "Device 0a1b… is bound to another account",
  "errors": { "phone": ["already registered"] },
  "requestId": "req_01H…"
}
```

`code` is a **contract**. The app renders a localized student-facing message
keyed by it and branches UI on it; `message` is developer text and is shown
only in development builds. The complete accepted list is in
`src/types/api.ts` (`ApiErrorCode`). An unrecognised code degrades to a generic
message — it does not crash, but the student loses the specific explanation.

`errors` maps field name → messages and is applied directly onto the
corresponding form field.

**Pagination.**

```json
{ "items": [...],
  "meta": { "page": 1, "pageSize": 20, "total": 87,
            "totalPages": 5, "hasNext": true } }
```

The client paginates on `meta.hasNext`, not on `items.length`.

**Headers sent on every request:**

| Header | Meaning |
|---|---|
| `Authorization: Bearer <accessToken>` | Omitted on login/register/refresh/catalog |
| `X-Device-Id` | Stable Keychain-backed device identity — the device-binding key |
| `X-Device-Platform` / `-Model` / `-Name` / `-Os` | Human-readable device descriptor |
| `X-Device-Integrity` | `ok` \| `suspect` — a **hint**; verify with Play Integrity / App Attest |
| `X-App-Version` / `X-App-Build` | For `APP_UPDATE_REQUIRED` gating |
| `Accept-Language` | `en` \| `ar` |
| `X-Request-Id` | Client-generated correlation id |
| `X-Client: mobile` | |

**Auth flow.** Access token + refresh token. The client refreshes proactively
when the JWT `exp` is within 30s, and reactively once on a 401, then replays
the request. Refresh is single-flight — concurrent 401s produce one refresh
call. If refresh fails, the client tears the session down and routes to login.

---

## Auth

### `POST /auth/login` *(anonymous)*

```jsonc
// request
{ "phone": "01001234567", "password": "…" }

// 200
{ "data": { "user": User, "accessToken": "…", "refreshToken": "…", "expiresIn": 900 } }
```

Errors: `INVALID_CREDENTIALS` · `ACCOUNT_DISABLED` · `ACCOUNT_PENDING` ·
`DEVICE_NOT_AUTHORIZED` · `DEVICE_LIMIT_REACHED` · `RATE_LIMITED`

Phone arrives normalized to `01XXXXXXXXX` (the client strips `+20` / `0020`).

### `POST /auth/register` *(anonymous)*

```jsonc
{ "fullName": "Ahmed Mohamed Ali",   // ≥3 parts, enforced client-side too
  "phone": "01001234567",
  "password": "…",
  "universityId": "u1", "facultyId": "f1",
  "departmentId": "d1", "academicYearId": "y3",
  "gender": "MALE" }
```

Response: same shape as login. Errors: `PHONE_ALREADY_REGISTERED` ·
`VALIDATION_ERROR` (use `errors` for per-field messages).

There is **no OTP step** in this system, by design.

### `POST /auth/refresh` *(anonymous)*

`{ "refreshToken": "…" }` → `{ accessToken, refreshToken, expiresIn }`.
Rotate the refresh token. Any failure here signs the student out.

### `POST /auth/logout`

Revoke the refresh token **and** release any active playback concurrency slot.
The client does not block on this call.

### `GET /auth/me` → `User`

Called on every cold start to revalidate the cached session.

---

## Catalog *(anonymous — needed on the registration screen)*

| Endpoint | Returns |
|---|---|
| `GET /catalog/universities` | `University[]` |
| `GET /catalog/universities/:id/faculties` | `Faculty[]` |
| `GET /catalog/faculties/:id/departments` | `Department[]` |
| `GET /catalog/academic-years` | `AcademicYear[]` |

Every entity carries both `name` and `nameAr`; the client picks by locale and
falls back to `name`.

---

## Home

### `GET /home/feed` → `HomeFeed`

```ts
{
  continueWatching: ContinueWatchingItem[],   // ≤6, most recent first
  myCourses: CourseSummary[],
  newCourses: CourseSummary[],
  recommended: CourseSummary[],
  announcements: AppNotification[],
  stats: { enrolledCourses, completedLessons, watchTimeSeconds, streakDays }
}
```

One request per dashboard render — keep it fast, it's the first screen.

---

## Courses

### `GET /courses`

Query: `page` `pageSize` `q` `universityId` `facultyId` `academicYearId`
`teacherId` `free` `sort` (`newest|popular|priceLow|priceHigh`).

Returns `Paginated<CourseSummary>`.

### `GET /courses/mine`

`Paginated<CourseSummary>` — everything the student has ever enrolled in,
**including `EXPIRED` and `ARCHIVED`**. The client buckets them; hiding them
server-side would leave students unable to see that they need to renew.

### `GET /courses/:id` → `CourseDetail`

Must be reachable **without access** — browsing is a distinct state from
joining. Return the full section/lesson tree with `locked: true` on gated
lessons rather than omitting them.

```ts
CourseDetail = CourseSummary & {
  description: string
  sections: CourseSection[]     // dynamic: any count, any titles, any order
  attachments: Attachment[]
  requirements: string[]
  outcomes: string[]
  updatedAt: string
}
```

**Sections are fully dynamic.** One course may be
`Before Midterm / Midterm Revision / After Midterm`, another
`Unit 1..3 / Midterm / Final Revision`, another `Part 1..4`. The client renders
your array in your `order`. Never assume a fixed count or naming scheme.

`access` drives the entire UI:

```ts
access: {
  state: 'NOT_ENROLLED' | 'PENDING_APPROVAL' | 'PENDING_PAYMENT'
       | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ARCHIVED'
  expiresAt: string | null          // null = lifetime
  enrolledAt: string | null
  availableMethods: ('FREE'|'PAYMENT'|'CODE'|'ADMIN_APPROVAL')[]
}
```

`availableMethods` is what the join sheet renders. An empty array means the
student cannot join right now and the UI routes them to support.

### `POST /courses/:id/enroll`

```jsonc
// request
{ "method": "FREE" | "PAYMENT" | "CODE" | "ADMIN_APPROVAL" }

// 200
{ "data": {
    "state": "ACTIVE",
    "courseId": "c1",
    "payment": { "provider": "paymob",
                 "checkoutUrl": "https://…",
                 "reference": "PAY-…" } | null } }
```

For `PAYMENT`, return `PENDING_PAYMENT` plus a `checkoutUrl`. The client opens
it in the **external browser** — card data never enters the app.

Errors: `PAYMENT_REQUIRED` · `COURSE_ARCHIVED` · `COURSE_NOT_AVAILABLE` ·
`ENROLLMENT_PENDING`

### `POST /courses/:id/redeem`

`{ "code": "DSA1-2026-ABCD" }` → same `EnrollmentResult`.
Errors: `INVALID_CODE` · `CODE_ALREADY_USED`

---

## Lessons

### `GET /lessons/:id` → `LessonDetail`

Enforce access here — do not rely on the client having hidden the row.
Errors: `NOT_ENROLLED` · `ACCESS_EXPIRED` · `COURSE_ARCHIVED`

```ts
completionRule: {
  type: 'WATCH_PERCENT' | 'WATCH_FULL' | 'MANUAL'
  threshold: number          // 0..100, for WATCH_PERCENT
  requireContiguous: boolean // if true, seeking past content doesn't count
}
```

`video` carries **metadata only** — id, duration, thumbnail, available
qualities, caption languages, status. **No URL.** A playable URL only ever
comes from a ticket.

### `POST /lessons/:id/complete` → `WatchProgress`

Only meaningful for `MANUAL` courses.

---

## Playback — the security-critical surface

### `POST /playback/videos/:videoId/ticket`

This single call performs the whole authorization chain:

```
authenticated? → account active? → course access? → lesson access?
→ video READY? → device authorized? → session valid?
→ concurrency slot available? → issue ticket
```

```ts
// 200
{
  ticketId: string
  manifestUrl: string             // signed, expiring HLS master playlist
  playbackHeaders: Record<string,string>
  drm: {
    scheme: 'widevine' | 'fairplay' | 'none'
    licenseUrl: string | null
    certificateUrl: string | null   // FairPlay only
    licenseHeaders: Record<string,string>
  }
  watermark: {
    primary: string        // e.g. "Ahmed Mohamed Ali"  — SERVER composes this
    secondary: string      // e.g. "ID: 12345"
    sessionTag: string     // opaque signed forensic token
    opacity: number        // 0..1
    moveIntervalSeconds: number
  }
  captions: { language, label, url, isDefault }[]
  expiresAt: string        // ISO
  ttlSeconds: number
  resumePositionSeconds: number    // authoritative resume point
  streamSessionId: string          // the concurrency slot
  heartbeatIntervalSeconds: number
}
```

Errors: `PLAYBACK_DENIED` · `VIDEO_NOT_READY` · `VIDEO_UNAVAILABLE` ·
`ACCESS_EXPIRED` · `COURSE_ARCHIVED` · `DEVICE_NOT_AUTHORIZED` ·
`DEVICE_INTEGRITY_FAILED` · `CONCURRENT_STREAM_LIMIT`

Requirements:
- `manifestUrl` **must expire** within `ttlSeconds`.
- Rate-limit issuance per account. This is the single most effective control
  against bulk scraping.
- The watermark payload is composed and signed **server-side**. A client that
  chooses its own watermark provides no forensic value.

#### Quality ceiling

The client appends `?maxHeight=720` (etc.) to `manifestUrl` for explicit
quality selection and for data saver. The delivery layer must honour it by
serving a pruned master playlist. Ignoring the parameter degrades gracefully
(the ladder just stays full), but data saver then has no effect.

### `POST /playback/tickets/:ticketId/heartbeat`

```jsonc
// request, every heartbeatIntervalSeconds
{ "positionSeconds": 412,
  "watchedDeltaSeconds": 30,
  "protection": { "secureSurface": true, "recording": false,
                  "externalDisplay": false } }

// 200
{ "data": { "ok": true,
            "ticket": PlaybackTicket | undefined,   // rotation
            "terminate": { "reason": "…" } | null } }
```

Use `terminate` to kill playback mid-lesson (access revoked, device unbound,
concurrency violation). Returning a fresh `ticket` rotates the manifest URL
without interrupting playback.

A transient heartbeat failure does **not** stop playback — only an explicit
authorization error (`PLAYBACK_TICKET_EXPIRED`, `SESSION_EXPIRED`,
`DEVICE_NOT_AUTHORIZED`, `CONCURRENT_STREAM_LIMIT`) does.

### `DELETE /playback/tickets/:ticketId`

Must actually free the concurrency slot. The client calls this on unmount; if
it is a no-op, students get locked out of their own next video.

### `POST /playback/security-events`

```jsonc
{ "threat": "SCREENSHOT" | "RECORDING_STARTED" | "RECORDING_STOPPED"
          | "EXTERNAL_DISPLAY" | "INTEGRITY",
  "videoId": "…", "courseId": "…", "lessonId": "…",
  "meta": { … },
  "occurredAt": "2026-08-17T18:02:11.000Z" }
```

Fire-and-forget from the client. Store it — this is the audit trail, and it
must live server-side where a patched client cannot strip it. Repeated
`SCREENSHOT` events from one account are a strong sharing signal.

---

## Progress

### `POST /progress`

```jsonc
{ "lessonId": "l12", "positionSeconds": 412, "watchedSeconds": 30 }
```

`watchedSeconds` is **contiguous** watch time since the last report — seeking
contributes zero. Returns the updated `WatchProgress`.

**Percent must be monotonic server-side.** The client assumes it never
decreases; recompute as `max(stored, new)`.

### `POST /progress/batch`

`{ "items": [ … ] }` — the offline replay path. The client queues failed
writes in MMKV, collapses duplicates per lesson, and flushes on reconnect.

### `GET /progress/continue-watching` → `ContinueWatchingItem[]`

---

## Attachments

### `GET /attachments/:id/ticket` → `AttachmentTicket`

`{ attachmentId, url, headers, expiresAt, watermark }`

Same model as video: short-lived signed URL, watermark payload, no permanent
public URL. The client opens it in the secure in-app viewer with downloads,
file access and navigation disabled.

---

## Notifications

| Endpoint | Notes |
|---|---|
| `GET /notifications?page&unread` | `Paginated<AppNotification>` |
| `GET /notifications/unread-count` | `{ count }` — polled every 60s for the tab badge |
| `POST /notifications/:id/read` | Optimistic client-side |
| `POST /notifications/read-all` | |
| `POST /notifications/devices` | `{ token, platform, provider: "expo" }` — key by `X-Device-Id` so unbinding a device kills its pushes |
| `DELETE /notifications/devices/:token` | Called on logout |
| `GET` / `PUT /notifications/preferences` | `{ newCourse, newLesson, announcements, payments }` |

**Push payload:** put a deep link in `data.route`, e.g. `"/course/c1"`. The
client validates it against an allow-list (`isSafeInternalRoute`) before
navigating — arbitrary URLs are dropped.

---

## Search

### `GET /search?q&entity` → `SearchResultGroup[]`

```ts
{ entity: 'COURSE'|'LESSON'|'TEACHER'|'ATTACHMENT',
  total: number,
  items: { id, entity, title, subtitle, thumbnailUrl,
           route, locked }[] }
```

`route` must be an internal app path; it is validated before navigation.
The client debounces 350ms and requires ≥2 characters.

---

## Profile & devices

| Endpoint | Notes |
|---|---|
| `GET /profile` → `User` | |
| `PATCH /profile` | Only `fullName` is editable from the app. Phone and academic fields are administrative. |
| `PUT /profile/password` | `{ currentPassword, newPassword }` |
| `GET /devices` → `AuthorizedDevice[]` | Include `current: true` for the calling device |
| `POST /devices/change-request` | `{ reason }` → creates an admin approval task |

---

## Meta

| Endpoint | Notes |
|---|---|
| `GET /meta/health` | Liveness |
| `GET /meta/app-config` | Reserved: minimum supported version, kill switches, feature flags. Return `426` + `APP_UPDATE_REQUIRED` from any endpoint to force an upgrade. |

---

## Implementation checklist

- [ ] `code` on every error, from the documented enum
- [ ] `{ data: … }` envelope
- [ ] Refresh token rotation; failure ends the session
- [ ] Course sections returned dynamically, in explicit `order`
- [ ] Locked lessons **returned with `locked: true`**, not omitted
- [ ] `GET /courses/:id` works for non-enrolled students
- [ ] Playback tickets expire, are single-session, and release on DELETE
- [ ] Watermark payload composed server-side
- [ ] Security events persisted
- [ ] Progress percent monotonic
- [ ] Device binding enforced on login *and* on ticket issuance
- [ ] Ticket issuance rate-limited
