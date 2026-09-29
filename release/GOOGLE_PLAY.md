# Google Play — preparation

Nothing here has been submitted. Play Console verification is pending.

## 1. Store listing

All text: STORE_LISTING.md. Graphics: `store-assets/`.

## 2. Screenshot checklist

Requirements: 2–8 phone screenshots, PNG/JPEG, 16:9 or 9:16, each side
320–3840 px (1080×1920 or 1080×2400 recommended). Optional 7" and 10" tablet
sets. Capture from the production build with the reviewer account, in **Arabic
and English** (one set per listing language), light mode, a clean status bar,
no real student names other than the reviewer account.

| # | Screen | Shows |
| --- | --- | --- |
| 1 | Home | Continue watching + announcement banner |
| 2 | Courses | Course list for a university/year |
| 3 | Course details | Sections and lessons, progress |
| 4 | Lesson player | Video playing with controls (watermark visible — that is fine) |
| 5 | Attachment viewer | A PDF note open |
| 6 | Library | Materials / bundles |
| 7 | Notifications | Alerts list |
| 8 | Settings or Support | Language/theme or a support ticket |

Playback screens are protected (`FLAG_SECURE` on Android, secure view on iOS),
so a screenshot taken while a lesson plays comes out black. Use the lesson page
before pressing play for screenshot 4, and never ship a build with protection
switched off to get screenshots.

## 3. App access (Play Console → App content → App access)

Choose **"All or some functionality is restricted"** and add instructions:

```
Sign-in is required. Use the account below (phone number + password).

Phone: <reviewer A phone>
Password: <reviewer A password>

This account already owns the course "<demo course>". To test unlocking a
course with an access code, open "<second course>" → Access code and enter:
<unused code>

Important:
• Please test on a physical device. Protected video playback is refused on
  emulators by design (content protection).
• Each account is limited to one device. If you need a second device, sign in
  there and we will approve the device-change request during the review.
• Screen recording and screenshots are blocked while a lesson video plays;
  the warning shown is expected behaviour.
• Course access is granted by the institution through free enrolment, access
  codes or administration approval. The app does not sell anything.
```

## 4. Data safety

Answers: DATA_SAFETY.md § 2. Deletion URL:
https://student-dashoard.vercel.app/account-deletion

## 5. Content rating (IARC questionnaire)

| Question area | Answer |
| --- | --- |
| Category | Reference, News, or Educational |
| Violence, fear, sexuality, profanity, crude humour, drugs/alcohol/tobacco, gambling | No |
| Users can interact / exchange content with each other | No (support tickets go to staff only; no chat, comments or posts between users) |
| Shares user's current location with others | No |
| Allows users to purchase digital goods | **Yes** — wallet credit is spent on library materials in the app, and access codes unlock courses |
| Unrestricted internet / web browser | No (a WebView renders PDFs only) |
| Expected result | Everyone / PEGI 3 / equivalent |

## 6. Target audience and content

| Item | Answer |
| --- | --- |
| Target age groups | **18 and over** (add **16–17** only if first-year students can be under 18). Do not select any group under 13 — that would put the app under the Families policy |
| Appeals to children | No |
| Ads | No |
| News app | No |
| Government app | No |
| Financial features | No |
| Health app | No |
| COVID-19 | No |
| Privacy policy | https://student-dashoard.vercel.app/privacy |

## 7. Payments policy check (before any production release)

Play's Payments policy requires Google Play Billing for digital content sold
**inside** the app. Keep the app from selling or linking to payment:

- `PAYMENT_PROVIDER` on Render must stay `none`.
- No published course may list `PAYMENT` in `enrollmentMethods` (it opens an
  external checkout from `EnrollSheet.tsx`). Read-only check, run where the
  database is reachable:
  ```sql
  SELECT id, title, status FROM courses
  WHERE 'PAYMENT' = ANY("enrollmentMethods") AND "deletedAt" IS NULL;
  ```
- The app shows prices and redeems codes/cards bought offline; it does not tell
  users where to buy. Keep it that way.

## 8. Closed testing

If the developer account is a **personal** account created after
13 Nov 2023, Google requires a closed test with **at least 12 testers opted in
for 14 consecutive days** before you can apply for production access.
Organisation accounts are exempt — check which type yours is on verification.

Plan:
1. Internal testing track first (up to 100 testers, no review wait) — upload
   the AAB, run APP_REVIEW_CHECKLIST.md.
2. Closed testing track "students-beta": Google Group or email list of ≥ 12
   real testers (students/team), each with their own account.
3. Keep them active for 14 days; collect feedback via in-app support.
4. Apply for production access (answers about the test: what was tested,
   feedback, changes made).
5. Production: staged rollout 20 % → 50 % → 100 %.

## 9. Release notes

STORE_LISTING.md → Release notes.

## 10. Pre-launch report

Play runs the build on test devices, including emulators. Expect video
playback to be refused there (integrity) — that is not a crash. Review the
report for real crashes and accessibility warnings only.
