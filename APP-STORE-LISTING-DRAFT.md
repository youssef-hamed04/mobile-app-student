# Student Center — App Store listing draft (English / العربية)

Draft for the owner to approve before it is entered in App Store Connect. It
describes only what the app does today. It deliberately says nothing about
prices, in-app purchases, wallet credit or activation codes — the iOS app has
none, and access is granted on the website or by the administration.

Limits: name 30 characters, subtitle 30, promotional text 170, keywords 100
(comma-separated, no spaces needed), description 4000.

---

## Name

| | English | العربية |
|---|---|---|
| App name | **Student Center** | **Student Center** (or an Arabic name the owner chooses — none is set in the app today) |

App names are unique across the App Store. If "Student Center" is taken, a
fallback such as "Student Center Courses" keeps the brand; the on-device name
stays "Student Center".

## Subtitle

- EN: `Your lectures and study files` (29)
- AR: `محاضراتك وملفات مذاكرتك` (23)

## Promotional text

- EN: `Watch your course lectures, pick up where you stopped, and read your study files — in Arabic or English.`
- AR: `شاهد محاضرات كورساتك، وكمّل من حيث توقفت، واقرأ ملفات مذاكرتك — بالعربية أو الإنجليزية.`

## Description — English

Student Center is the study app for students enrolled with Student Center.
Sign in with your student account to reach the courses on your account,
organized the way your university is: by faculty, department and year.

- Watch course lectures in a protected video player, at the speed that suits
  you, with your place remembered so you can continue where you stopped.
- Browse each course by parts and sections and see your progress through it.
- Watch preview lessons that are open to every student.
- Read your study files and revision papers in the built-in reader.
- Get notified about new lectures and announcements (optional).
- Contact support from inside the app.
- Use the app in Arabic or English, in light or dark mode.

Course access is managed on your Student Center account. Content is protected
for its authors: videos and documents are watermarked to your account, and
recording the screen is not allowed while protected content is open.

## الوصف — العربية

‏Student Center هو تطبيق المذاكرة لطلاب Student Center. سجّل الدخول بحساب
الطالب للوصول إلى الكورسات المتاحة على حسابك، مرتبة كما في جامعتك: حسب
الكلية والقسم والفرقة.

- شاهد محاضرات الكورسات في مشغّل فيديو محمي، بالسرعة التي تناسبك، مع حفظ
  مكانك لتكمل من حيث توقفت.
- تصفّح كل كورس حسب أجزائه وأقسامه وتابع تقدّمك فيه.
- شاهد الدروس التجريبية المتاحة لكل الطلاب.
- اقرأ ملفات المذاكرة وملازم المراجعة في القارئ المدمج.
- استقبل إشعارات المحاضرات الجديدة والإعلانات (اختياري).
- تواصل مع الدعم من داخل التطبيق.
- استخدم التطبيق بالعربية أو الإنجليزية، بالوضع الفاتح أو الداكن.

تتم إدارة الوصول إلى الكورسات من خلال حسابك في Student Center. المحتوى محمي
لأصحابه: الفيديوهات والملفات عليها علامة مائية باسم حسابك، وتسجيل الشاشة غير
مسموح أثناء عرض المحتوى المحمي.

## Keywords

- EN: `lectures,courses,university,study,students,faculty,revision,videos,notes,learning,Egypt` (85)
- AR: `محاضرات,كورسات,جامعة,مذاكرة,طلاب,كلية,مراجعة,ملازم,فيديو,تعليم` (64)

## Category

Primary **Education**. Secondary: none needed (optionally Reference).

## Review notes (paste into App Review Information → Notes)

> Student Center is a content-consumption app for students of our education
> service. Students receive access to courses on our website or from our
> administration; the iOS app does not sell anything, shows no prices, has no
> in-app purchase, wallet or code redemption, and contains no links or
> instructions to buy elsewhere. It shows the content already on the signed-in
> account, plus free preview lessons.
>
> Demo account: the phone number and password are in the Sign-In Information
> fields. It has an active course with videos and library documents.
>
> Accounts are bound to one device to protect paid content. The demo account
> has no device bound, so the first device you sign in on is accepted. If you
> also test on a second device, it needs approval; we will approve it during
> the review window.
>
> Video is DRM-protected (FairPlay) and the app blocks screen recording and
> blanks protected content in screenshots and the app switcher by design; it
> is not an error.
>
> Account deletion: Profile → Settings → Account → Delete account (asks for
> the password; deletion completes after 30 days unless cancelled by signing
> in).

(Phone number and password are entered only in App Store Connect, never here.)

---

## App Privacy — draft answers (owner must confirm)

Derived from what the app actually sends (see `DATA-SAFETY.md`). Nothing is
used for **tracking**; there is no advertising identifier and no third-party
analytics or ad SDK.

| App Store data type | Collected | Linked to user | Purpose | Notes |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | App Functionality | account |
| Contact Info → Phone Number | Yes | Yes | App Functionality | sign-in |
| Contact Info → Email Address | No | — | — | the app never asks for an email (registration and profile have no email field; the privacy policy says so) |
| User Content → Photos | Optional | Yes | App Functionality | profile photo picked by the student |
| User Content → Customer Support | Yes | Yes | App Functionality | support tickets |
| Identifiers → Device ID | Yes | Yes | App Functionality | app-generated id; one account per device |
| Usage Data → Product Interaction | Yes | Yes | App Functionality (and Analytics if the owner uses progress for reporting) | lessons opened, watch position, completion |
| Diagnostics → Other Diagnostic Data | Yes | Yes | App Functionality | screenshot / recording **events** (never the image) and device-integrity signals |
| Other Data → academic details, gender | Yes | Yes | App Functionality | university, faculty, department, year |
| Purchases → Purchase History | **Owner decision** | — | — | the app shows which courses the account holds but takes no purchase; the account's purchase records are created on the website |
| Diagnostics → Crash Data | **Confirm** | — | — | no crash-reporting SDK is in the app; answer "no" unless one is added |

Not collected: location, contacts, browsing/search history, health, financial
info, audio, other photos/videos, advertising data.

---

## Still needed before submission

| Item | Status |
|---|---|
| iPhone screenshots | **missing** — take them from a TestFlight build signed in to the demo account, in English and Arabic. No iPad screenshots: 1.0.0 is iPhone-only |
| Privacy policy URL | **ready** — https://student-dashoard.vercel.app/privacy (public, English/Arabic, matches the consumption-only app since 11 November 2026) |
| Support URL | **ready** — https://student-dashoard.vercel.app/contact (public, English/Arabic: contacts, sign-in, devices, playback, deletion) |
| Marketing URL | optional |
| App Review demo account | **to be created** by the administration following `APP-REVIEW-ACCOUNT.md` |
| Age rating questionnaire | to answer in App Store Connect (education content; no user-generated content shared with other users; no web browsing) — owner confirms |
| App Privacy | confirm the table above |
| Copyright line | owner's legal entity name |
