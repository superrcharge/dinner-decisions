# Invite links that open the app

An invite link is `https://dinnerdecisions.app/#join=CODE`.
On a phone with the app, tapping it should open the app at the join screen; on any other phone it opens the website, as today.

## What is built

| Part | Where | Status |
|---|---|---|
| Android claims `https://dinnerdecisions.app/` (the home page only, so privacy and other pages stay in the browser) | `android/app/src/main/AndroidManifest.xml`, `autoVerify` intent filter | Done, tested on the emulator |
| iPhone claims `dinnerdecisions.app`, invite links only (`#join=`) | `ios/App/App/App.entitlements` and the file below | Done, not yet built on a Mac |
| The page opens the join screen for the link, from cold or while open, once | `openAppLink` in `index.html` | Done, tested |
| The two files Apple and Google check on the website | Written by `scripts/build-site.mjs` from `store/app-links.json` | Waits for the two values below |

## What is missing: two values

Both stores check a file on the website before they let an app open its links.
The files carry values that exist only once the developer accounts do, so the site build writes each file only when its value is filled in `store/app-links.json`:

| Value | Where to find it | File it makes |
|---|---|---|
| `appleTeamId` | Apple Developer account, Membership details, Team ID (10 letters and digits) | `/.well-known/apple-app-site-association` |
| `androidCertSha256` | Play Console, the app, Test and release, App integrity, App signing: the **App signing key certificate** SHA-256. Add the **Upload key certificate** SHA-256 too, so internal test builds verify. | `/.well-known/assetlinks.json` |

Then publish the website (`mise run site-deploy`, with Mike's go), and check:

```bash
curl -sI https://dinnerdecisions.app/.well-known/apple-app-site-association
curl -s https://dinnerdecisions.app/.well-known/assetlinks.json
```

The Apple file must come back as `application/json` (set in `firebase.json`).
`firebase.json` has `"ignore": []` so Firebase Hosting serves the `.well-known` folder; its default would skip dot folders.

On an Android phone with the app from Play: `adb shell pm get-app-links app.dinnerdecisions` should show `dinnerdecisions.app: verified`.
`npm run test:app` checks the files, the manifest and the entitlements agree.

## Until then

Links open the website, which works as it always has.
In the Android app's settings (Open by default, Add link) a person can approve the address by hand; the device test does exactly that.
