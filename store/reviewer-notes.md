# Notes for the app reviewers (draft)

Paste the block below into App Store Connect (App Review Information, Notes) and Play Console (App access, instructions).

Before submitting, start a family in the store build itself, give it a few meals, and put its invite code where the block says.
Keep that code out of this repo; it lives only in the two consoles.
Delete that family after approval and make a new one for the next review.

## Sign-in

Apple: "Sign-in required" is **No**.
Play: "All functionality is available without special access", or add the invite code as the instructions below.

## The note

```
Dinner Decisions is a dinner picker for a household. There are no accounts, usernames or passwords: each phone is signed in anonymously, and phones join a family with an invite code.

To try it on your own:
1. Tap "Start a family", type any family name and first name, and tap Create.
2. Tap "Add starter meals" to fill the list, then tap a few meals to vote for them.
3. Open the Shopping tab to see the tally. Tap Add on a meal to put it in this week's plan.
4. The Manage tab (unlocked on the phone that started the family) edits meals and ingredients; with ingredients set, Shopping shows the week's grocery list.

To join a family that already has meals and votes in it:
Tap "I have a code" and type: [REVIEWER INVITE CODE]
Then tap your name at the top, choose a name or add one, and vote.

What only the app does: Share (the invite, the week's plan, the shopping list) opens the phone's share sheet; Print on the shopping list opens the phone's print screen on Android and sends the list as a PDF to the share sheet on iPhone; tapping a meal gives a light haptic tap; an invite link (https://dinnerdecisions.app/#join=...) tapped on a phone with the app opens the app straight to the join screen; vote reminders are weekly local notifications (tap your name, then Vote reminders, Turn On). Where a state law requires it, the app reads the store's age signal and pauses only if the store says a parent has declined approval.

Deleting data: tap your name at the top, then "Delete My Data". It removes this phone from the family, deletes the name it picks as and that name's votes, deletes the anonymous sign-in, and clears the phone. "Delete this family" at the bottom of Manage deletes the whole family for everyone. Both are explained at https://dinnerdecisions.app/delete.html.

What the app does beyond the website: the app's pages and the Firebase SDK are bundled in the app, so it opens and shows the family's list with no signal; optional vote reminders are scheduled on the phone as weekly local notifications (tap your name, then Vote reminders, Turn On); the icon, splash screen and notification icon are native.

The app has no ads, no analytics and no tracking, and sells nothing.

Contact: hello@dinnerdecisions.app
```

## Apple guideline 4.2 (minimum functionality)

The likeliest objection is "a repackaged website".
What answers it:

| Native value | Status |
|---|---|
| Web app bundled in the app, works offline | Done |
| Vote reminders as local notifications | Done |
| In-app account deletion | Done |
| Native icon, splash, notification icon | Done |
| Native share sheet for the invite, the plan and the shopping list (`@capacitor/share`) | Done, tested on the Android emulator |
| Print: Android's own print screen (`PrintPlugin.java`); on iPhone a PDF to the share sheet (`@capacitor/filesystem`) | Done; Android tested on the emulator, iPhone not yet built |
| Haptics on a vote (`@capacitor/haptics`) | Done, tested on the Android emulator |
| Invite links that open the app (App Links, Universal Links) | Done in the apps and tested on the emulator; goes live when the two files are served, which needs the Apple Team ID and the Play signing fingerprint (see `app-links.md`) |
| Store age signals (Play Age Signals, Apple Declared Age Range) | Done, tested on the emulator with Google's test double |

Mention the share sheet, print, haptics, invite links and reminders in the review note (above), so the reviewer sees them.
