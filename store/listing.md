# Store listings (draft)

Drafts for the Apple App Store and Google Play listings.
Paste each block into the field named above it.
Character limits are the stores' own; the count after each block is this draft's length.

Wording rules for every listing, screenshot caption and reply to a review:

- Say "family members" or "everyone in the house", never "kids".
- It is a household tool for adults running a home; family members of any age may vote, but the listing never targets children.
- Do not mention Plus, prices, Instacart or Walmart until Plus is in the apps.
- No claims we cannot back up ("the best", "#1", "loved by thousands").

## Both stores

**App name** (Apple 30, Google 30)

```
Dinner Decisions
```

16 characters.

**Category:** Food & Drink (both stores).
Apple secondary category: Lifestyle.

**Support URL:** `https://dinnerdecisions.app/`
**Privacy policy URL:** `https://dinnerdecisions.app/privacy.html`
**Account and data deletion URL (Google asks for it):** `https://dinnerdecisions.app/delete.html`
**Contact email:** `hello@dinnerdecisions.app`

## Apple App Store

**Subtitle** (30)

```
Pick this week's dinners
```

24 characters.

**Promotional text** (170, can be changed without a new version)

```
Everyone in the house taps the dinners they'd happily eat this week. Whoever does the shopping sees what won, and the grocery list that goes with it.
```

149 characters.

**Keywords** (100, comma separated, no spaces after commas; the app name and category are already indexed)

```
meal planner,menu,vote,poll,household,grocery list,shopping list,weekly,supper,family meals,recipes
```

99 characters.

**Description** (4000)

```
Dinner, decided together.

Everyone in the house opens Dinner Decisions on their own phone and taps the meals they'd be happy to eat this week. Whoever does the shopping sees a live tally: which meals won, who picked them, and who hasn't voted yet.

HOW IT WORKS
- Start a family and send the invite to everyone in the house. They open the link or type the code, and they're in.
- Pick meals: tap the dinners you'd like. Anything that isn't on the list can be typed in and added for the week.
- Shopping: meals ranked by votes. Tap Add to build the week's plan.
- Grocery list: give a meal its ingredients once, and the week's plan turns into one list to shop from, with shared ingredients merged.
- Share the plan and the list, or copy them into a message.
- The week starts fresh every Sunday. Nobody has to reset anything.

MADE FOR A HOUSEHOLD
- No accounts, no email, no passwords. A phone joins once with the invite code and is remembered.
- Manage, the meal list and the settings, sits behind its own separate code, so it stays with whoever runs the kitchen.
- Optional vote reminders on Sunday mornings, set on your phone. Off until you turn them on.
- Opens without a signal and shows your family's list from last time.

PRIVATE BY DESIGN
- No ads, no analytics, no tracking.
- First names only. Your family's meals and votes are seen by your family and nobody else.
- Delete My Data removes this phone's data, its name and its votes from inside the app. Delete this family removes everything, for everyone.

Free.
```

About 1,500 characters.

**What's New** (first version)

```
The first version of Dinner Decisions for iPhone.
```

## Google Play

**Short description** (80)

```
Everyone votes on the week's dinners. The shopper sees what won and what to buy.
```

80 characters.

**Full description** (4000)

Use the Apple description above, unchanged.
It has no Apple-only wording.

**Release notes** (first version)

```
The first version of Dinner Decisions for Android.
```

## Graphics

Made by `mise run store-screenshots` (tests/store/screens.spec.mjs) from the app itself, with a sample family that has no real names in it ("The Parkers": Sam, Alex, Jordan, Riley), built on the local emulators the way a person would build it.
Re-run it after any change to how the app looks.

| Store | Asset | Size | File |
|---|---|---|---|
| Google Play | App icon | 512 x 512 PNG | `store/graphics/play-icon-512.png` |
| Google Play | Feature graphic | 1024 x 500 PNG | `store/graphics/play-feature-graphic-1024x500.png` |
| Google Play | Phone screenshots | 6 at 1080 x 1920 | `store/screenshots/play-phone/` |
| Google Play | 7-inch tablet screenshots | 6 at 1080 x 1920 | `store/screenshots/play-tablet-7in/` |
| Google Play | 10-inch tablet screenshots | 6 at 1440 x 2560 | `store/screenshots/play-tablet-10in/` |
| Apple | iPhone 6.9" screenshots | 6 at 1320 x 2868 | `store/screenshots/apple-iphone-6.9in/` |
| Apple | App icon | 1024 x 1024 | Already in the Xcode project; App Store Connect takes it from the build. |

Meal icons are emoji, which each phone draws with its own font.
The Play sets use Google's Noto Color Emoji, as Android does.
The iPhone set made on Windows uses Noto too; run `mise run store-screenshots` once on the Mac so it shows Apple's emoji, as an iPhone does.

Screenshot captions, one per screen, set above each screen on the app's green:

1. "Everyone taps the dinners they'd like"
2. "See what won, and who picked it"
3. "One grocery list for the week"
4. "Invite the house with a link or a code"
5. "Your meal list, behind its own code"
6. "A weekly reminder, only if you want one" (an app-only feature, which helps with Apple's 4.2 rule)
