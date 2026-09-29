# Apple App Store — preparation

Nothing has been signed, built for iOS, or submitted. The Apple Developer
account is not verified yet.

## 1. App Store metadata

STORE_LISTING.md → "Apple App Store". Other fields:

| Field | Value |
| --- | --- |
| Bundle ID | `com.eduplatform.app` (register it in Certificates, Identifiers & Profiles, or let `eas build` create it) |
| SKU | `student-center-ios` (any unique string) |
| Primary language | Arabic or English (match Play) |
| Category | Education |
| Price | Free |
| Availability | Egypt (add others only if you serve them) |
| Age rating questionnaire | No objectionable content in any category; no unrestricted web access; no user-to-user communication; no gambling/contests; not "Made for Kids". Expected rating: 4+ |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` is already set (`usesNonExemptEncryption: false`) — standard HTTPS only |
| Content rights | Answer "Yes, it contains third-party content and I have the rights" — lessons are produced by your instructors; make sure your agreements with them allow distribution |

## 2. Screenshot checklist

Required sizes (App Store Connect accepts one set per family and scales down):

| Device family | Size (portrait) | Needed because |
| --- | --- | --- |
| iPhone 6.9" | 1320×2868 (or 1290×2796) | always required |
| iPad 13" | 2064×2752 (or 2048×2732) | **required because `ios.supportsTablet` is `true`** |

Same 8 screens as GOOGLE_PLAY.md § 2, per language. Take them on the
TestFlight build (or a simulator build pointed at production, for non-video
screens). The playing-video screen is protected and captures black — use the
lesson page instead.

If you do not want to support iPad at launch, setting `supportsTablet: false`
removes the iPad screenshot and review requirement. That is a product decision;
it is **not** changed here.

## 3. App Review Information

- Sign-in required: **Yes** — username = reviewer B phone, password in the
  console only.
- Contact: your name, phone, email.
- Notes (paste and fill):

```
Student Center is a study app for university students in Egypt. Students watch
recorded lessons of their university courses, open lesson attachments and
library materials, receive announcements and contact support.

DEMO ACCOUNT
Sign in with the phone number and password provided in Sign-In Information.
The account already owns the course "<demo course>" (open My Courses).
To test unlocking another course with an access code: Courses → "<second
course>" → Access code → <unused code>.
If you test on a second device (e.g. iPad), please use the second account:
phone <reviewer C phone>, password in the notes field below / contact us —
each account is limited to one device, and we will also approve device
changes promptly during review.

BEHAVIOUR YOU MAY SEE
• Screenshots and screen recording are blocked while a lesson plays, and
  playback stops if recording is detected. This protects instructors' content.
• Videos show a watermark with the student's name.

ACCESS AND PAYMENT
The app does not sell anything and contains no purchase flow or external
payment link. Course access is granted by the student's institution —
free courses, access codes handed out by the teaching staff, or approval by
the administration.

ACCOUNT DELETION
Settings → Delete account (guideline 5.1.1(v)). Web page:
https://student-dashoard.vercel.app/account-deletion

PRIVACY
https://student-dashoard.vercel.app/privacy
```

Before pasting, make sure every sentence in "ACCESS AND PAYMENT" is true for
the build and data under review (see § 5).

## 4. App Privacy

Answers: DATA_SAFETY.md § 3. Privacy Policy URL:
https://student-dashoard.vercel.app/privacy. No tracking, no ATT prompt.

## 5. Risks specific to App Review — decide before submitting

1. **Guideline 3.1.1 (payments).** Apple does not allow unlocking digital
   content with codes/credit bought outside the app unless it is also offered
   through In-App Purchase. Today the app redeems course access codes, shows
   prices ("Join for …", "Buy", "Buy bundle") and spends wallet credit topped
   up with recharge cards on library items. Reviewers may reject this.
   Options (all require your decision — none implemented here):
   a) submit as is with the notes above, framing codes as institution-issued
      enrolment; b) on iOS only, hide prices, the Buy/recharge UI and the
      wallet, and keep code redemption; c) add Apple IAP for library items.
   The optional **Pay online** method (external checkout) is a certain
   rejection if a reviewer can reach it — it must be off for every course
   (GOOGLE_PLAY.md § 7 query).
2. **5.1.1(v) account deletion.** Deletion starts in-app (good). The in-app
   text says the team "will contact you on your registered phone number to
   confirm before the deletion is completed"; Apple asks that deletion not
   require a phone call for apps outside regulated industries. Consider
   rewording to "may contact you if anything needs checking" and processing
   tickets without a call.
3. **2.1 completeness.** Demo content must play on the reviewer's device on
   first try: videos READY, Render awake, device approvals watched.
4. **iOS never compiled.** The custom Swift module
   (`modules/content-protection/ios`) has not been built yet — build and test
   on internal TestFlight before anything else (NEXT_ACTIONS.md).
5. **Push on iOS** needs an APNs key, created by `eas credentials` once the
   account is active.

## 6. TestFlight test plan

| Stage | Who | What | Exit criteria |
| --- | --- | --- | --- |
| 0. First build | you | `eas build -p ios --profile production`, then `eas submit -p ios --latest` (goes to TestFlight; internal testers need no review) | Builds; app launches; content protection module loads |
| 1. Internal TestFlight | you + team (App Store Connect users, no review) | Full APP_REVIEW_CHECKLIST.md on iPhone and iPad, Arabic and English, light and dark | All rows ticked; no crashes in TestFlight feedback |
| 2. External TestFlight | 10–30 students (needs Beta App Review, usually < 48 h) | Normal use for 5–7 days: watch lessons, redeem codes, support tickets, notifications | No crash clusters; push delivered; no device-binding surprises |
| 3. Submit | — | Same build number that passed stage 2 | — |

What to test on TestFlight specifically: push notifications (APNs), screen
recording detection and secure view on iOS, PDF viewer, iPad layout, video
resume after background/foreground, cold start with Render asleep.

## 7. Demo account requirements (summary)

Two to three student accounts prepared as in REVIEW_ACCESS.md (one per
reviewer device), each owning a demo course with READY videos, one PDF
attachment, access to one library item, plus one unused access code. No staff
account is given to Apple.
