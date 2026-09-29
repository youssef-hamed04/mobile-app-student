# Store listing — proposed text

Every feature named here exists in the current build and was checked against
the code. Deliberately **not** advertised: captions (tracks exist on the server
but the player does not render them yet), online payment (must be disabled for
review — see APPLE.md), offline downloads (not a feature), teacher tools (the
teacher experience is the web dashboard, not this app).

Character counts are within each store's limit (checked with a script).

---

## Shared facts

| Field | Value |
| --- | --- |
| App name (both stores) | **Student Center** (14/30) |
| Default language | Arabic (ar) with English (en-US) as a second listing — or the reverse if you prefer English first |
| Google Play category | Education |
| App Store primary category | Education |
| App Store secondary category | none (optional: Reference) |
| Contains ads | No (the home carousel shows the platform's own announcements only) |
| In-app purchases (store billing) | None |
| Support email | startuppp3@gmail.com *(a domain address such as support@… is recommended before launch)* |
| Support phone / WhatsApp | +20 110 111 2344 |
| Website / Support URL | https://student-dashoard.vercel.app/contact |
| Privacy policy URL | https://student-dashoard.vercel.app/privacy |
| Account deletion URL | https://student-dashoard.vercel.app/account-deletion |
| Copyright (App Store) | © 2026 Student Center |

---

## Google Play

### Short description (max 80)

- **en:** Your university courses, recorded lessons and study materials in one app. (73)
- **ar:** كورسات جامعتك ودروسك المسجلة ومواد المذاكرة في تطبيق واحد. (58)

### Full description — English

```
Student Center brings your university courses to your phone.

Find the courses for your university and academic year, join them, and watch
recorded lessons prepared by your instructors — then pick up exactly where you
left off.

COURSES AND LESSONS
• Browse the courses available for your university and academic year
• Join free courses directly, or unlock a course with the access code you
  received, or request access from the administration
• Watch lessons with resume, playback speed and quality controls
• Track your progress and continue watching from the home screen
• Open lesson attachments such as PDF notes inside the app

LIBRARY
• Study materials and bundles in one place
• Unlock them with your wallet credit — add credit with a recharge card

STAY UP TO DATE
• Notifications when new lessons and announcements are published
• Search across courses, lessons, instructors and attachments

HELP WHEN YOU NEED IT
• Contact support from inside the app and follow every request
• Ask for your account to be deleted at any time from Settings

BUILT FOR STUDENTS
• Full Arabic and English interface, right-to-left support
• Light and dark themes
• Your lessons are protected: each account is linked to its device and videos
  carry a personal watermark, so your instructors' work stays yours to study

An account is required. Course access is provided by your institution's
teaching team through free enrolment, access codes or administration approval.
```

### Full description — Arabic

```
Student Center يجمع كورسات جامعتك على موبايلك.

اعثر على كورسات جامعتك وفرقتك الدراسية، وانضم إليها، وشاهد الدروس المسجلة
التي أعدّها محاضروك — وكمّل من نفس النقطة اللي وقفت عندها.

الكورسات والدروس
• تصفّح الكورسات المتاحة لجامعتك وفرقتك الدراسية
• انضم للكورسات المجانية مباشرة، أو افتح الكورس بكود الوصول اللي معاك، أو اطلب
  الوصول من الإدارة
• شاهد الدروس مع استكمال المشاهدة والتحكم في السرعة والجودة
• تابع تقدّمك وكمّل المشاهدة من الشاشة الرئيسية
• افتح مرفقات الدروس زي ملفات PDF داخل التطبيق

المكتبة
• مواد المذاكرة والباقات في مكان واحد
• افتحها برصيد محفظتك — واشحن الرصيد بكارت شحن

خليك متابع
• إشعارات عند نشر دروس وإعلانات جديدة
• بحث في الكورسات والدروس والمحاضرين والمرفقات

مساعدة وقت ما تحتاجها
• تواصل مع الدعم من داخل التطبيق وتابع كل طلب
• اطلب حذف حسابك في أي وقت من الإعدادات

معمول للطلاب
• واجهة كاملة بالعربي والإنجليزي
• الوضع الفاتح والداكن
• دروسك محمية: كل حساب مربوط بجهازه والفيديوهات عليها علامة مائية شخصية

يلزم وجود حساب. يتم توفير الوصول للكورسات من فريق التدريس عن طريق الاشتراك
المجاني أو أكواد الوصول أو موافقة الإدارة.
```

### Release notes — first release (max 500)

- **en:** `First release of Student Center: courses, recorded lessons with resume, attachments, library, notifications and in-app support, in Arabic and English.`
- **ar:** `الإصدار الأول من Student Center: الكورسات، الدروس المسجلة مع استكمال المشاهدة، المرفقات، المكتبة، الإشعارات والدعم داخل التطبيق، بالعربي والإنجليزي.`

### Graphics

| Asset | Status |
| --- | --- |
| App icon 512×512 | ready — `store-assets/play-icon-512.png` (from `assets/images/icon.png`) |
| Feature graphic 1024×500 | ready — `store-assets/play-feature-graphic-1024x500.png` (brand plate + lockup) |
| Phone screenshots | to capture — see GOOGLE_PLAY.md |

---

## Apple App Store

| Field | en-US | ar-SA |
| --- | --- | --- |
| Name (30) | Student Center | Student Center |
| Subtitle (30) | University courses & lessons (28) | كورسات ودروس جامعتك (19) |
| Promotional text (170) | Your university courses, recorded lessons and study materials — in Arabic and English. | كورسات جامعتك ودروسك المسجلة ومواد المذاكرة — بالعربي والإنجليزي. |
| Keywords (100 bytes) | `university,college,faculty,lectures,lessons,study,students,exam,learning,education,library,notes` (96) | `كورسات,محاضرات,دروس,جامعة,كلية,مذاكرة,طلاب,امتحانات` (51 characters, 95 bytes UTF-8 — under 100 either way) |
| Description | Same text as the Google Play full description above | Same as the Arabic Play description |
| What's New | not shown for the first version | — |
| Support URL | https://student-dashoard.vercel.app/contact | same, `?lang=ar` |
| Marketing URL | leave empty | — |
| Privacy Policy URL | https://student-dashoard.vercel.app/privacy | same |

The App Review notes are in APPLE.md.
