# Shipping the Android build

Everything that could be prepared in the repository is done. What is left needs
an interactive login to Expo and to Google Play, so it has to be run by a human.

## Before anything else — fill in three values

`eas.json` → `build.production.env` has three `REPLACE_ME` placeholders:

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_SUPPORT_PHONE` | the number a stuck student calls |
| `EXPO_PUBLIC_SUPPORT_WHATSAPP` | the WhatsApp number, with country code |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | the support inbox |

These are shown on the "forgot password" and "contact the administration"
screens. The build refuses to start while they are placeholders — deliberately,
because a student who needs help and finds a dead number is worse than a student
who cannot install the app.

## Then

```bash
npx eas-cli login          # the Google account that owns the Play developer account
npx eas-cli init           # writes EAS_PROJECT_ID
npx eas-cli build --profile production --platform android
```

The first build creates the Android signing key and keeps it on Expo's servers.

**Back it up the day it is created:**

```bash
npx eas-cli credentials
```

If that key is lost, this app can never be updated again under the same
listing — Play identifies an app by its signature, and a new key means a new
app and every install starting from zero.

## Uploading

Either upload the `.aab` by hand in the Play Console, or wire up automatic
submission:

1. Play Console → Setup → API access → create a service account with the
   *Release manager* role.
2. Download its JSON key to `credentials/play-service-account.json`.
   That folder is gitignored; the key is a password to your store listing.
3. `npx eas-cli submit --profile production --platform android`

`eas.json` sends it to the **internal** track as a **draft**, so nothing reaches
students until you promote it yourself.

## What Play will ask for

- **A privacy policy at a public URL.** `PRIVACY.md` is the text, written
  against what the app actually does. Publish it somewhere stable — a GitHub
  Pages site or a page on your own domain — and give Play that link.
- **The Data safety form.** `DATA-SAFETY.md` has the answers.
- **A content rating questionnaire**, an app category, a short and full
  description, a 512×512 icon, a 1024×500 feature graphic, and at least two
  phone screenshots.

## Check on the first build

`android.versionCode` is `1` in `app.config.ts` while `eas.json` sets
`autoIncrement: true`, which should override it. Confirm the number EAS reports
for the first build, because Play rejects a version code it has already seen —
and that rejection arrives after the upload, not before.
