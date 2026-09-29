# Final app review checklist

Run on the **store build** (Play internal-testing AAB install, TestFlight on
iOS) against production, on a real phone, with a reviewer-style account.
Tick each item on Android and iOS. Anything unticked blocks submission.

Tester: ______  Build: Android ____ / iOS ____  Date: ______

| # | Area | Check | Android | iOS |
| --- | --- | --- | --- | --- |
| 1 | Production API | Settings → About this app shows "production" and the build number; no "(Dev)"/"(Stg)" in the launcher name; app name is **Student Center** | ☐ | ☐ |
| 2 | No mock data | Courses, teachers and numbers match the dashboard exactly; nothing that looks like sample data | ☐ | ☐ |
| 3 | No development URLs | Any link opened from the app (privacy, terms, deletion, WhatsApp, email) points to production hosts only | ☐ | ☐ |
| 4 | Signup | Register a new account (three-part name, Egyptian phone, university → faculty → department → year, gender); lands signed in | ☐ | ☐ |
| 5 | Signup errors | Existing phone, weak password, two-word name, bad phone: each shows a clear message in the current language | ☐ | ☐ |
| 6 | Login | Correct credentials sign in; wrong password shows an error; "Forgot your password?" opens the help screen with support contacts | ☐ | ☐ |
| 7 | Token refresh | Leave the app signed in > 15 min (or past the access-token lifetime), reopen: still signed in, data loads, no logout | ☐ | ☐ |
| 8 | Logout | Profile → Log out → confirm; returns to login; reopening the app stays logged out | ☐ | ☐ |
| 9 | Courses | Courses tab lists courses for the account's university/year; filters work; empty state is sensible | ☐ | ☐ |
| 10 | Course details | Owned course shows sections and lessons; not-owned course shows only allowed methods (free / code / approval) — **no "Pay online"** | ☐ | ☐ |
| 11 | Access code | Redeem the spare code: success; reuse it: clear refusal | ☐ | ☐ |
| 12 | Lectures | Open a lesson; locked lessons explain why | ☐ | ☐ |
| 13 | Video playback | Plays, seek, speed, quality, fullscreen/rotation; watermark visible | ☐ | ☐ |
| 14 | Video resume/completion | Leave mid-video, return: resume prompt; finish a lesson: marked complete, progress bar and "continue watching" update | ☐ | ☐ |
| 15 | Content protection | Screenshot / screen recording during playback is blocked or stops playback with the explained message (expected) | ☐ | ☐ |
| 16 | Attachments | PDF attachment opens and scrolls in the viewer | ☐ | ☐ |
| 17 | Library | Library lists materials; unlock one with wallet credit; reader opens it; wallet balance and history update | ☐ | ☐ |
| 18 | Wallet | Redeem a recharge card (if one is available): balance increases; invalid card refused | ☐ | ☐ |
| 19 | Notifications list | Alerts tab shows announcements; mark read works; tapping a deep link opens the right screen | ☐ | ☐ |
| 20 | Push behaviour | Permission prompt appears once; a test announcement arrives with the app in background and killed; tapping opens the app; after logout no pushes arrive for that account | ☐ | ☐ |
| 21 | Profile | Edit profile fields allowed by settings; choose and remove a profile photo (library picker only, no camera prompt) | ☐ | ☐ |
| 22 | Devices | Settings → devices shows this device; second device goes to "pending approval" and plays after admin approval | ☐ | ☐ |
| 23 | Support | Create a ticket, see it in the list, receive a reply from the dashboard | ☐ | ☐ |
| 24 | Legal links | Settings → About this app → Privacy / Terms open the Vercel pages (not an email draft) | ☐ | ☐ |
| 25 | Account deletion | Settings → Delete account explains consequences; submitting creates a support ticket and opens it; the web link opens /account-deletion. (Use a throwaway account.) | ☐ | ☐ |
| 26 | Arabic / RTL | Switch to Arabic: every screen mirrors, no English leftovers, numbers/phones readable, player controls correct | ☐ | ☐ |
| 27 | Dark mode | System dark and in-app dark: every screen readable, no white flashes, PDF/library reader readable | ☐ | ☐ |
| 28 | Error states | Airplane mode: offline banner, cached screens still render, actions show retryable errors | ☐ | ☐ |
| 29 | Network failure | Server slow/unreachable (e.g. first request after Render sleep): "server unreachable" message, retry recovers without restarting | ☐ | ☐ |
| 30 | Session loss | Admin disables the account or resets devices: app signs out / explains, no crash | ☐ | ☐ |
| 31 | Tablet (iOS, because `supportsTablet: true`) | iPad layout usable in portrait and landscape | — | ☐ |
| 32 | Cold start | Fresh install → splash (orange plate, cog) → login in < 5 s on a warm server | ☐ | ☐ |
| 33 | Permissions | Only notifications (and photo library when choosing an avatar) are ever requested | ☐ | ☐ |
