# Student Center — store release package

Prepared 2026-09-29, while Google Play Console and Apple Developer verification
are pending. Everything here was traced to the code in `edu-backend`,
`edu-dashboard` and this app at that date. **No credentials live in this
folder, and none may be added to it.**

| File | What it is |
| --- | --- |
| [STORE_LISTING.md](STORE_LISTING.md) | Names, descriptions, keywords, category, release notes (Play + App Store, EN + AR) |
| [REVIEW_ACCESS.md](REVIEW_ACCESS.md) | Reviewer/demo account strategy and exactly what to prepare |
| [DATA_SAFETY.md](DATA_SAFETY.md) | Google Play Data safety answers + App Store privacy answers, with code sources |
| [APP_REVIEW_CHECKLIST.md](APP_REVIEW_CHECKLIST.md) | One final device test pass before every submission |
| [GOOGLE_PLAY.md](GOOGLE_PLAY.md) | Screenshots, app access, content rating, target audience, closed testing |
| [APPLE.md](APPLE.md) | App Store metadata, screenshots, review notes, privacy, TestFlight plan |
| [NEXT_ACTIONS.md](NEXT_ACTIONS.md) | Exact commands once the accounts are verified |
| `store-assets/` | Play hi-res icon (512×512) and feature graphic (1024×500), made from the app's own artwork |

## Identity

| | Value |
| --- | --- |
| App name | Student Center |
| Android package | `com.eduplatform.app` |
| iOS bundle id | `com.eduplatform.app` |
| Version | 1.0.0 (build numbers managed remotely by EAS, `autoIncrement: true`) |
| API | `https://student-backend-814y.onrender.com/api/v1` |
| EAS project | `f5f88e33-01f3-4049-ae16-6c3cd5221f57` |

## Public URLs (served by the dashboard on Vercel)

| Purpose | URL | Where it is entered |
| --- | --- | --- |
| Privacy policy | https://student-dashoard.vercel.app/privacy | Play: App content → Privacy policy · App Store Connect: App Privacy → Privacy Policy URL · EAS `EXPO_PUBLIC_PRIVACY_POLICY_URL` |
| Terms | https://student-dashoard.vercel.app/terms | EAS `EXPO_PUBLIC_TERMS_URL` · optional in App Store description (EULA link) |
| Account deletion | https://student-dashoard.vercel.app/account-deletion | Play: Data safety → Delete account URL · EAS `EXPO_PUBLIC_ACCOUNT_DELETION_URL` |
| Support | https://student-dashoard.vercel.app/contact | App Store Connect: Support URL · Play: store listing website (optional) |

Arabic versions: append `?lang=ar`. The pages go live when the dashboard
changes are deployed to Vercel (see NEXT_ACTIONS.md step 1). The host name is
the existing Vercel project name (`student-dashoard`, spelled as the project
is); if you add a custom domain later, update the three EAS variables and both
store consoles together.

## Open risks to decide before submitting (details in APPLE.md / GOOGLE_PLAY.md)

1. **Payments (highest App Store risk).** Content is unlocked with access codes
   and wallet credit bought outside the app. Apple guideline 3.1.1 treats that
   as a rejection risk. The optional "Pay online" method opens an external
   checkout — it must be disabled for every published course.
2. **Device binding.** `student.deviceLimit` is 1 and emulators are blocked for
   protected content. Reviewers need accounts prepared for this
   (REVIEW_ACCESS.md).
3. **Account deletion.** Deletion is a soft delete that keeps the name and
   phone number on the disabled record. The public pages say so accurately.
   The in-app screen says the team will phone to confirm — Apple prefers
   deletion that needs no call. Both are product decisions, not changed here.
4. **iOS has never been compiled** (custom Swift module). Do a preview build
   as soon as the Apple account is active.
