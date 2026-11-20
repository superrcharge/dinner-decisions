# Store apps: status and paperwork

Dinner Decisions for Android and iPhone is the website wrapped with Capacitor, bundled inside the app.
This folder holds the drafts the two stores ask for.
Nothing here has been submitted; there are no store accounts yet.

| File | What it is |
|---|---|
| [listing.md](listing.md) | Name, subtitle, descriptions, keywords, URLs, screenshots to make |
| [apple-privacy.md](apple-privacy.md) | App Store Connect privacy answers, privacy manifest, account deletion, export compliance |
| [google-data-safety.md](google-data-safety.md) | Play Console Data safety form and the other App content declarations |
| [content-rating.md](content-rating.md) | Target audience (18+ on Play), IARC and Apple age rating answers |
| [reviewer-notes.md](reviewer-notes.md) | What to tell the reviewers, and what answers Apple's 4.2 rule |
| [app-links.md](app-links.md) | Invite links that open the app, and the two values they still need |

## What is built

- `android/` and `ios/`: Capacitor 8 projects, app id `app.dinnerdecisions`, Android target API 36, iPhone only.
- The app carries the website's own files (`www/`, made by `scripts/build-app.mjs` from `dist/`), with the Firebase SDK inside the app rather than loaded from Google.
- Delete My Data, vote reminders (local notifications, Sundays at 9 AM, off by default), icon, splash and notification icon.
- The phone's own share sheet for Share, Android's print screen for Print (a PDF to the share sheet on iPhone), a haptic tap on a vote, invite links that open the app, and the stores' age signals for the state app-store laws.
- `mise run android-debug` builds a debug APK on Windows.

## What needs Mike's accounts or money

| Item | Cost | Needs |
|---|---|---|
| Google Play Console, as an organization | $25 once | Dinner Decisions LLC approved, its D-U-N-S number, identity check |
| Apple Developer Program, as an organization | $99 a year | The LLC, its D-U-N-S number, the dinnerdecisions.app website and an `@dinnerdecisions.app` email |
| D-U-N-S number | Free | Requested once the LLC is approved; never pay for "expedited". Apple says to allow up to 5 business days for the number, then up to 2 business days before Apple can see it |
| iPhone builds on Mike's MacBook | Free | Xcode 26 or later; a free Apple ID is enough for the simulator and his own iPhone |
| iPhone builds on GitHub Actions macOS runners | Free for a public repo | Only if the MacBook cannot run Xcode 26; Mike's yes before the workflow is pushed |

## Checked on the stores' own pages (Nov 20, 2026)

Read from developer.apple.com and support.google.com on Nov 20, 2026; check again before submitting.

Apple:

- The Apple Developer Program is 99 USD a year; the fee waiver is only for nonprofits, schools and government.
- An organization enrolls with a legal entity (no DBAs or trade names), a D-U-N-S number, a website on its own domain, a work email on that domain and someone with authority to sign.
  An individual enrolls with a legal name, which is then shown as the seller.
  Apple's enrollment page says to contact them to convert an individual account to an organization.
- A free Apple Account can run the app from Xcode on its own devices ("Personal Team"): up to 3 devices, and each build stops working after 7 days.
  It has no App Store Connect, so no TestFlight.
- Uploads to App Store Connect must be built with Xcode 26 or later and the iOS 26 SDK (since April 28, 2026).
  Xcode 26.0 to 26.3 run on macOS Sequoia 15.6 or later, Xcode 26.4 to 26.6 need macOS Tahoe 26.2, and Xcode 27.x needs macOS Tahoe 26.6.
- TestFlight: up to 100 internal testers with no review; up to 10,000 external testers after the first build passes beta review; a build lasts 90 days.
- Screenshots: 1 to 10 per size; 1320 x 2868 is accepted for the large iPhone size, which is what `store/screenshots/apple-iphone-6.9in/` holds.
- The App Privacy answers and a privacy policy URL are required to submit; an app that creates accounts must offer deletion inside the app.

Google Play:

- Registration is a one-time US$25, by card.
- An organization account needs a D-U-N-S number, an organization website, phone and email, a government ID and an official organization document.
  Google Play then shows the organization's legal name, D-U-N-S number, legal address, email and phone number on the store listing, so settle which address and phone the LLC uses before asking for the D-U-N-S number.
- A personal account shows the legal name, country and email, and the full address only if it monetizes; a new personal account must also run a closed test with at least 12 testers opted in for 14 days in a row before it can ask for production.
- New apps must target Android 16 (API level 36) or higher since August 31, 2026; this app targets 36.
- Listing assets: a 512 x 512 icon, a 1024 x 500 feature graphic and 2 to 8 phone screenshots are required; tablet screenshots are optional.
- Internal testing: up to 100 testers, available straight away; the Data safety form is needed for closed, open and production tracks.
- Before a first release: privacy policy URL, Data safety form, content rating questionnaire, target audience, ads declaration, and the deletion page URL because the app counts as having accounts.

## The Firebase API key and the app's addresses

The page talks to Firebase with the same API key as the website.
Inside the apps the page's address is not dinnerdecisions.app but the app's own:

| Platform | The page's origin inside the app |
|---|---|
| Android | `https://localhost` |
| iPhone | `capacitor://localhost` |

The key is restricted to the website's addresses in Google Cloud (APIs & Services, Credentials, the browser key for project `dinner-decisions-6af97`).
Checked on Nov 17, 2026 with a request that reads and writes nothing: Google answers "Requests from referer https://localhost/ are blocked" and the same for `capacitor://localhost/`.
Until these two were added to the key's website restrictions, the apps could not sign in to the live project:

```
https://localhost/*
capacitor://localhost/*
```

Added on Nov 18, 2026, with Mike's yes (Google Cloud, signed in as the project's owner account).
Checked the same way straight after: both app addresses now get through, and an unrelated site (`https://example.com/`) is still refused.
Adding them does not weaken anything that matters, because the data is protected by the Firestore security rules, not by the key.
When saving, Google warned the key has seen calls to its geocoding service, which is not on the key's list of allowed services, so those calls are refused; nothing in this repo calls it.
Later the same night the key's API list was narrowed from Firebase's default 25 services to the four the app uses (see the README's setup steps); the live check passed afterwards.
Firebase Authentication's own "Authorized domains" list (Authentication, Settings) already includes `localhost` by default; check it still does.

## Before the first submission

1. LLC approved, D-U-N-S number, then both developer accounts (above).
2. Fill `store/app-links.json` (Apple Team ID, Play signing fingerprints) and publish the website, so invite links open the app. See `app-links.md`.
3. Release signing: an upload key for Play (kept out of git, with a backup), and Apple certificates in GitHub Actions secrets.
4. iPhone build and TestFlight from GitHub Actions; sign-in works in the iPhone app (checked in the simulator, see below).
5. Screenshots and the feature graphic are made (`mise run store-screenshots`, see `listing.md`); the iPhone set was redone on the Mac on Nov 20, 2026. Then Play internal testing and TestFlight, then review. Have a lawyer read the age-signal handling (`content-rating.md`).
6. Privacy policy: now covers the apps, reminders and age signals; publish it with the website before the apps go live, and update its effective date then.
7. Icon artwork: done. The pot is now `icons/pot.svg`, Microsoft's Fluent Emoji "Pot of food" under the MIT License, the same drawing the Windows emoji font showed, so the icon looks the same. The licence's copyright notice is kept in `icons/pot-LICENSE.txt` and on the Terms page.

## Known gaps

- **iPhone: built and tried in the simulator on Nov 20, 2026** (Xcode 27.2, iOS 27.2, `mise run ios-sim`), not yet on a real iPhone.
  Sign-in, starting a family, Share invite, Share plan, Print (a PDF to the share sheet, and its Print action), Vote reminders (the permission prompt and Turn On), Delete My Data, dark mode and the icon all work.
  The known iPhone sign-in problem is dealt with: Firebase Auth's compat SDK loads Google's popup sign-in helper (an iframe from `apis.google.com`) on phones, which is the known cause of slow or stuck sign-in inside iPhone apps.
  `scripts/build-app.mjs` removes that helper from the app's copy only (the change Firebase recommends for Capacitor); the Android device test and `mise run ios-test` check a fresh install signs in within seconds.
  Still to try on a real iPhone: the haptic tap, and invite links once `store/app-links.json` has the Team ID.
- Google Play now lists Android 17 (API 37). Capacitor 8 targets API 36, which Play accepts for new apps until its next yearly deadline (normally August).
