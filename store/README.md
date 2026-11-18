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
| [reviewer-notes.md](reviewer-notes.md) | What to tell the reviewers, and what is still needed against Apple's 4.2 rule |

## What is built

- `android/` and `ios/`: Capacitor 8 projects, app id `app.dinnerdecisions`, Android target API 36, iPhone only.
- The app carries the website's own files (`www/`, made by `scripts/build-app.mjs` from `dist/`), with the Firebase SDK inside the app rather than loaded from Google.
- Delete My Data, vote reminders (local notifications, Sundays at 9 AM, off by default), icon, splash and notification icon.
- `mise run android-debug` builds a debug APK on Windows.

## What needs Mike's accounts or money

| Item | Cost | Needs |
|---|---|---|
| Google Play Console, as an organization | $25 once | Dinner Decisions LLC approved, its D-U-N-S number, identity check |
| Apple Developer Program, as an organization | $99 a year | The LLC, its D-U-N-S number, the dinnerdecisions.app website and an `@dinnerdecisions.app` email |
| D-U-N-S number | Free (up to about 30 days) | Requested once the LLC is approved; never pay for "expedited" |
| iPhone builds on GitHub Actions macOS runners | Free for a public repo | Mike's yes before the workflow is pushed |

## The Firebase API key and the app's addresses

The page talks to Firebase with the same API key as the website.
Inside the apps the page's address is not dinnerdecisions.app but the app's own:

| Platform | The page's origin inside the app |
|---|---|
| Android | `https://localhost` |
| iPhone | `capacitor://localhost` |

The key is restricted to the website's addresses in Google Cloud (APIs & Services, Credentials, the browser key for project `dinner-decisions-6af97`).
Checked on Nov 17, 2026 with a request that reads and writes nothing: Google answers "Requests from referer https://localhost/ are blocked" and the same for `capacitor://localhost/`.
So the apps cannot sign in to the live project, and the debug APK only shows "On this device", until these two are added to the key's website restrictions:

```
https://localhost/*
capacitor://localhost/*
```

This has **not** been changed: it is the live key, and changing it waits for Mike's yes.
Adding them does not weaken anything that matters, because the data is protected by the Firestore security rules, not by the key.
Firebase Authentication's own "Authorized domains" list (Authentication, Settings) already includes `localhost` by default; check it still does.

## Before the first submission

1. LLC approved, D-U-N-S number, then both developer accounts (above).
2. The rest of Track A step 3, so the app is clearly more than the website (Apple 4.2): invite links that open the app, native share and print on Android, haptics. See `reviewer-notes.md`.
3. Release signing: an upload key for Play (kept out of git, with a backup), and Apple certificates in GitHub Actions secrets.
4. iPhone build and TestFlight from GitHub Actions; check sign-in works in the iPhone app (untested so far, see below).
5. The age-signal plugins (Texas law), then screenshots, then Play internal testing and TestFlight, then review.
6. Privacy policy: its "Who we are" line covers the web app only; add the apps when they are published.
7. Icon artwork: the pot is the Segoe UI Emoji glyph (Microsoft's font), as on the website. Before the icon goes into the stores, redraw it or switch to an openly licensed emoji (Noto, Twemoji) so the store icon carries no font-licensing question.

## Known gaps

- **iPhone is untested.** There is no Mac here; the iOS project is generated but has not been built. Firebase's compat SDK has a known history of slow or stuck sign-in inside iOS WebViews; the first GitHub Actions build must check that a new phone reaches "Not joined" and can start a family.
- **Android Share** copies to the clipboard instead of opening the share sheet, and **Print** does nothing, because Android's WebView has neither. Both need `@capacitor/share` (planned with step 3).
- Google Play now lists Android 17 (API 37). Capacitor 8 targets API 36, which Play accepts for new apps until its next yearly deadline (normally August).
