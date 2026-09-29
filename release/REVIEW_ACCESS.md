# Reviewer / demo access

**Never put these passwords in the repository, in EAS variables, in source code
or in chat.** They go only into Play Console → App content → App access, App
Store Connect → App Review Information → Sign-in information, and your own
password manager.

## Why reviewers need special preparation

Traced in the backend:

| Behaviour | Where | Effect on a reviewer |
| --- | --- | --- |
| Sign-in is phone number + password; self-registration creates an ACTIVE student | `auth.service.ts` register | Reviewers can register, but a fresh account owns no courses and they would see empty screens |
| One device per student (`student.deviceLimit` = 1) | `devices.service.ts` `handleUnknownDevice`, `platform-settings.service.ts` | The first device binds automatically. A second device (Apple often tests on iPhone **and** iPad) is parked "pending approval" and cannot play video until an admin approves it |
| Emulators/simulators flagged `integritySuspect`, and `DEVICE_BLOCK_ON_INTEGRITY_FAILURE=true` | `services/device.ts`, `devices.service.ts` | Protected video refuses on an emulator. Google's reviewers and pre-launch report may use emulators |
| Screen recording stops playback | `playback.service.ts` | A reviewer recording the screen will see "Screen capture blocked" — expected behaviour, explain it in the notes |
| API on Render | — | If the instance is asleep the first request can take tens of seconds; the app shows "server unreachable" and retries |

## Teacher reviewer — not needed

The mobile app is student-only: there is no teacher, admin or upload feature in
it. Teachers and admins use the web dashboard, which is not submitted to either
store. Do not give reviewers a staff account.

## Accounts to create (production)

Create them by registering **in the app** (that is the only way a student is
created), using phone numbers you control. Suggested:

| Account | For | Notes |
| --- | --- | --- |
| Reviewer A | Google Play review | Full access (below) |
| Reviewer B | Apple review — iPhone | Full access |
| Reviewer C | Apple review — iPad | Full access; separate account so the iPad binds on its own |
| Spare | Re-submissions | Keep unused until needed |

For each account:

1. Register in the app with a real-looking three-part name (e.g. "App Review
   Google"), a phone number you control, a strong unique password, and a real
   university / faculty / department / year that has published courses.
2. In the dashboard, generate an **access code** for one demo course
   (Codes → Generate) and redeem it on the account in the app, so the reviewer
   lands on a course they already own.
3. Generate **one more unused code** for a second course and put it in the
   review notes, so the reviewer can test redemption themselves.
4. Optional, to show the Library: Wallet → adjust the account's balance with a
   small credit so one library material can be unlocked. (Or give an unused
   recharge card code.)
5. Sign out on your own device, then in the dashboard Students → open the student →
   **Reset device binding**, so the reviewer's device binds on first sign-in.

## The demo course must have

- At least one section with 2–3 lessons whose videos are **READY** (processed
  and playable today — do not rely on uploading during review; the video worker
  runs on the Windows PC).
- At least one PDF attachment on a lesson.
- At least one library material the reviewer can open or unlock.
- Enrollment methods limited to **FREE / CODE / ADMIN_APPROVAL**. No course
  visible to reviewers may list **PAYMENT** (it opens an external checkout).
- A recent announcement, so Notifications is not empty.

## What each reviewer should be able to do

Sign in · browse courses for their university/year · open the owned course ·
play a lesson and see resume work · open an attachment · redeem the spare code ·
open Library · read notifications · open a support ticket · change language and
theme · open Privacy/Terms from Settings → About this app · reach
Settings → Delete account (ask them **not** to submit it, or be ready to
recreate the account).

## During the review window

- Watch Dashboard → device change requests and approve reviewer devices
  quickly.
- Reply to any support ticket from a reviewer account.
- If the Render instance sleeps on its plan, keep it warm (open the app or hit
  `https://student-backend-814y.onrender.com/api/v1/meta/health` periodically) while the review is running.
- After approval: reset the passwords and device bindings of the reviewer
  accounts, and keep them for the next release.

## Text for the stores

Use the notes templates in GOOGLE_PLAY.md (App access) and APPLE.md (App Review
notes); fill phone/password only in the consoles.
