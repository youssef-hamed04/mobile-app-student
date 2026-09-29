# Google Play — Data safety answers

Taken from what the app actually sends, not from what a template assumes. Each
entry says why, so the form can be filled in without re-deriving it.

**Is data encrypted in transit?** Yes. The app refuses cleartext HTTP entirely
(`usesCleartextTraffic=false` plus a network security config).

**Can users request deletion?** Yes — by writing to the support address in the
privacy policy.

## Collected and linked to the user

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Name | Yes | No | Account management |
| Phone number | Yes | No | Account management, sign-in |
| Email address | Optional | No | Account management |
| Gender | Yes | No | Account management |
| Photos | Optional | No | Profile photo, only if the user picks one |
| Other personal info (university, faculty, department, academic year) | Yes | No | App functionality — decides which courses apply |
| Purchase history | Yes | No | App functionality — what the account owns |
| App interactions (lessons opened, watch position, watch time, completion) | Yes | No | App functionality, analytics |
| Device or other IDs | Yes | No | App functionality (one account = one device), fraud prevention |
| Crash logs / diagnostics | Yes | No | App functionality, security |

## Not collected

Location, contacts, calendar, SMS or call logs, health or fitness, financial
info, files or documents from the device, audio, video or photos other than a
profile photo the user chooses, browsing history, advertising ID.

## Worth saying plainly on the form

The app reports **that** a screen recording or screenshot happened while paid
content is on screen. It never captures or transmits screen contents. Declare it
under diagnostics/security, and say so in the description — an undeclared
capture-detection signal is exactly the kind of thing a reviewer flags.

The app requests `DETECT_SCREEN_CAPTURE` and `DETECT_SCREEN_RECORDING`, and
deliberately blocks camera, microphone and external storage permissions that
libraries would otherwise merge in.
