# Next actions — exact steps

Run from Windows PowerShell unless noted. Nothing here was executed by the
preparation pass; these are the steps to perform.

## A. Now (no store account needed)

1. **Publish the legal pages** — commit and push the dashboard (Vercel deploys
   `main` automatically):
   ```powershell
   cd C:\Users\mahmoud\Desktop\edu-dashboard
   git add 'src/app/(public)' src/features/public-site src/middleware.ts src/app/globals.css e2e/public-pages.spec.ts
   git commit -m "Add public privacy, terms, account deletion and support pages"
   git push
   ```
   Then open, signed out, in a private window:
   https://student-dashoard.vercel.app/privacy ·
   /terms · /account-deletion · /contact (and each with `?lang=ar`).

2. **Set the three legal URLs on EAS** (production environment). Required: the
   production build now refuses to start without them.
   ```powershell
   cd C:\Users\mahmoud\Desktop\edu-mobile-final\mobile-app-student
   eas env:list --environment production
   eas env:create --environment production --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value https://student-dashoard.vercel.app/privacy --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_TERMS_URL --value https://student-dashoard.vercel.app/terms --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_ACCOUNT_DELETION_URL --value https://student-dashoard.vercel.app/account-deletion --visibility plaintext
   ```
   While in that list, confirm: `EXPO_PUBLIC_API_URL` =
   `https://student-backend-814y.onrender.com/api/v1`, `EXPO_PUBLIC_ENABLE_DRM`
   is absent or `false`, the three `EXPO_PUBLIC_SUPPORT_*` values are real, and
   `GOOGLE_SERVICES_JSON` is a **file** variable (visibility secret).

3. **Commit the mobile changes** (review `git status` first — there are other
   uncommitted edits in this repo that are yours):
   ```powershell
   git add app.config.ts tsconfig.json .env.example src/api/client.ts src/i18n/locales/en.json src/i18n/locales/ar.json __tests__/production-config.test.ts release
   git commit -m "Require legal URLs for store builds; drop mock backend from production bundle; release package"
   git push
   ```

4. **Rebuild the production AAB** with the legal URLs baked in, and install
   the `production:apk` variant on a phone to run APP_REVIEW_CHECKLIST.md:
   ```powershell
   eas build -p android --profile production
   eas build -p android --profile production:apk
   ```

5. **Check the database for course payment methods** (see
   GOOGLE_PLAY.md § 7) and confirm `PAYMENT_PROVIDER=none` on Render.

6. **Verify Android push credentials**: `eas credentials -p android` → the
   production build profile shows an FCM V1 service-account key. If not,
   upload it there (never into the repo).

7. **Prepare reviewer accounts and demo content** (REVIEW_ACCESS.md) and
   capture Android screenshots (GOOGLE_PLAY.md § 2).

8. Decide the open items: payments on iOS (APPLE.md § 5.1), deletion wording
   and data scrubbing (APPLE.md § 5.2, DATA_SAFETY.md § 4), iPad support.

## B. Immediately after Google Play Console is verified

1. Play Console → Create app: name **Student Center**, default language, App,
   Free, accept declarations.
2. Fill App content: privacy policy, app access (GOOGLE_PLAY.md § 3), ads = No,
   content rating (§ 5), target audience (§ 6), data safety (DATA_SAFETY.md
   § 2), government/financial/health = No.
3. Store listing: texts from STORE_LISTING.md, `store-assets/` icon and
   feature graphic, screenshots.
4. **First upload must be manual** (the API cannot create an app's first
   release): Testing → Internal testing → Create release → upload the AAB from
   step A.4 (download it from the EAS build page). Play App Signing: accept
   Google-managed key; the EAS keystore stays the upload key — do **not**
   generate a new keystore.
5. Add internal testers, install from the Play link, run the checklist.
6. For automated submissions later: create the Play service account
   (docs/MANUAL_STEPS.md), save its JSON as
   `credentials/play-service-account.json` (gitignored), then:
   ```powershell
   eas submit -p android --profile production --latest
   ```
   (`eas.json` submits to the internal track as a draft.)
7. Closed testing with ≥ 12 testers for 14 days if the account is personal
   (GOOGLE_PLAY.md § 8), then apply for production and roll out in stages.

## C. Immediately after the Apple Developer account is verified

1. App Store Connect → My Apps → **+** → New App: iOS, name **Student
   Center**, bundle id `com.eduplatform.app`, SKU `student-center-ios`.
2. Build and send to TestFlight (EAS creates the certificate, provisioning
   profile and — when prompted — the APNs push key; answer **Yes** to
   generating a push key):
   ```powershell
   cd C:\Users\mahmoud\Desktop\edu-mobile-final\mobile-app-student
   eas build -p ios --profile production
   eas submit -p ios --profile production --latest
   eas credentials -p ios
   ```
   (the last command is to confirm a Push Notifications key is attached.)
3. Internal TestFlight: run APP_REVIEW_CHECKLIST.md on iPhone and iPad.
4. Fill App Privacy (DATA_SAFETY.md § 3), age rating, metadata and
   screenshots (APPLE.md), App Review information with the reviewer accounts.
5. External TestFlight group (optional but recommended), then **Add for
   Review** with the build that passed.

## D. Every later release

```powershell
eas build -p android --profile production
eas build -p ios --profile production
eas submit -p android --profile production --latest
eas submit -p ios --profile production --latest
```
Version codes / build numbers increment automatically (`appVersionSource:
remote`, `autoIncrement: true`). Bump `version` in `app.config.ts` for a new
user-visible version; note that `runtimeVersion` follows `version`, so OTA
updates only reach builds with the same version.
