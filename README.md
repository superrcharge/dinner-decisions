# Dinner Decisions

A one-page dinner picker for families.
Everyone in the house opens it on their own phone, taps the meals they'd be happy to eat this week, and whoever does the shopping sees a live tally.

**→ [superrcharge.github.io/dinner-decisions](https://superrcharge.github.io/dinner-decisions/)**

No accounts to create, nothing to install, no email. Any phone, any browser. Free.

Anyone can start a family from the welcome screen.
Starting one hands back an invite code and link to send to the rest of the house.
A phone joins once, by opening the link or typing the code, and is remembered from then on.
A stranger who finds the URL can start a family of their own, and can see nothing of anyone else's.

## How it works

- **Pick meals** - tap tiles to vote. Everything you've chosen is gathered into a **Your picks** strip at the top, so you can read your own selections back without hunting for green tiles. Type anything that isn't on the list and it joins that week's options straight away.
- **Shopping** - meals ranked by votes, with who picked each one and who hasn't voted yet. Build the week's plan by tapping *Add*.
- **Manage** - hidden behind its own separate code, not the family one. Edit the master meal list, keep or dismiss what the kids suggested, set a meal's icon, list what a meal needs, clear the week.

The tab strip sticks to the top of the screen, so the three views stay reachable however far down the list you've scrolled.

The week rolls over on its own every Sunday. Nobody has to reset anything.

## Starting and joining

**Starting a family:** tap **Start a family**, give the family a name and yourself a first name, and tap **Create**.
The phone that starts a family has Manage unlocked, and is shown the invite straight away.
A new family's meal list is empty, so the Pick tab offers **Add starter meals**: sixteen common dinners, written exactly as if they had been typed into Manage, to rename or remove at will.

**Inviting:** the invite is a 10-character code such as `X3UHC-636A8`, and a link that carries it.
**Share invite** opens the phone's own share sheet where there is one and copies the message otherwise.
The invite is reachable afterwards from the name menu (**Invite someone**) and from **Manage → Your family**.
Codes never use `0`, `O`, `1`, `I` or `L`, so one read aloud cannot be mistyped into another.

**Joining:** open the link, or tap **I have a code** and type it.
Case, spaces and the dash do not matter, and pasting the whole link into the box works too.
The phone then asks who is picking, as it always has.

On an iPhone, a link opened from a message lands in Safari, which keeps its storage apart from a copy installed on the home screen.
A home-screen copy therefore needs the code typed into it once, which is why the code is shown in a form that is easy to type.

**Changing the code:** **Manage → Your family → New code**.
The old code stops working at once; phones already in the family stay in.

**Leaving:** the name menu's **Leave** link takes this phone out of the family and clears what it had cached.
Everyone else keeps everything, and coming back needs the invite code.

**Deleting:** **Manage → Delete this family**, confirmed by typing the family's name.
It removes every meal, vote, name, ingredient and invite for everyone.
Other phones notice within a second or two and return to the welcome screen with a line saying why.

A phone whose family has gone, or that has been removed from it, says so and returns to the welcome screen rather than sitting on an empty list.

## Grocery list

Meals can carry a list of ingredients, and the week's plan turns them into one list to shop from.

**Adding them** - in **Manage**, tap anywhere on a meal's row to open it, and tap again to close. **+ Ingredient** does the same but puts the cursor straight in the box. The small number beside a meal's name is how many it already has, so you can read the list without opening anything. Nothing is shown until you tap, so the tab stays as quiet as it was before.

A meal holds up to 20 ingredients. That is roughly double a long recipe - it is a guardrail, not a target.

**Shopping from it** - the **Shopping** tab shows a **To buy** list under the week's plan, built from whatever is locked in. It only appears for someone who has entered the Manage code, because they are the one doing the shopping. Everyone else sees the plan exactly as before.

Ingredients needed by more than one meal are merged and the list says which meals they are for. Items only one meal needs are left unannotated, so the list stays short.

**What the merge does and does not do.** Two ingredients merge when their text matches exactly, ignoring case and surrounding spaces - so `Onion` and `onion` become one line. It is plain text matching, so `onion` and `onions` stay separate, and so do `chicken` and `2 lbs chicken`. Being consistent in how you type them is what keeps the list tidy; the app will not guess.

Planned meals with nothing listed yet are named beneath the list, so a short list explains itself.

**Not built: ticking things off as you shop.** Deliberately left out for now rather than overlooked. It needs somewhere to keep per-week checked state that every phone can see, which means new Firestore documents and a rules change - worth doing only once the list has been shopped with a few times and it is clear what is actually wanted.

## Installing it on a phone

Safari: share menu → *Add to Home Screen*. Chrome: ⋮ → *Add to Home screen*.

It installs as **Dinner Decisions** with a pot icon and opens without browser chrome, so it behaves like an app rather than a bookmark.

That has one consequence worth knowing: a page running standalone has **no address bar and no pull-to-refresh**. That's why the bottom bar carries a **Reload** button, and why a green *"A newer version is ready"* strip appears on its own when new code has shipped. Without those, the only way to update would be to force-quit the app.

The version check deliberately asks for the same copy a reload would get, rather than going straight to the origin. Querying the origin would let it announce a version that a reload can't actually fetch yet - so it would prompt, you'd reload, nothing would change, and it would prompt again.

## How a meal gets its icon

Icons aren't stored and aren't looked up - they're worked out in the browser from the meal's name every time a tile renders.

1. A keyword table maps names to glyphs, most specific first, so *Chicken Alfredo* matches `alfredo` (🍝) before it reaches `chicken` (🍗).
2. Anything unmatched falls back to a neutral 🍴.
3. **Manage → Icon** overrides it: paste any emoji and it's written to that meal's `icon` field, which wins over the matcher and reaches every phone in about a second.

The override is the normal way to fix a glyph - it needs no code change and no deploy. Editing the keyword table only makes sense for a whole category that keeps recurring.

The Icon button appears on meals in the master list, not on pending suggestions, so *Keep* one first and then set its icon.

## How it's put together

Two moving parts that never talk to each other: GitHub serves the code, Firestore holds the data, and the page in the browser is the only thing that touches both.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/runtime-dark.svg">
  <img src="./diagrams/runtime-light.svg" alt="Signal flow: GitHub Pages serves index.html to the browser and answers its periodic check for a newer build. The page fetches the Firebase SDK and fonts from gstatic and signs in anonymously with Firebase Auth, but signing in is not enough - the security rules reject any device not admitted to the household it is asking about. Everything in Firestore sits under households/&lt;hid&gt;/. localStorage holds which household this phone joined, who it is picking as, and a cached copy of that household&apos;s lists. Other phones hold their own live connections to the same Firestore." width="100%">
</picture>

Deploying a change is a push.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/hosting-dark.svg">
  <img src="./diagrams/hosting-light.svg" alt="Deploy path: this machine pushes to the GitHub repo, which triggers a Pages build, which publishes to the Fastly edge, which serves the file to a family phone." width="100%">
</picture>

## Firebase

Project **`dinner-decisions-6af97`**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./diagrams/firebase-dark.svg">
  <img src="./diagrams/firebase-light.svg" alt="Firebase: Anonymous Auth issues a token to the security rules, which gate every read and write into Cloud Firestore. Everything nests under a households collection whose ids cannot be listed, beside a top-level invites collection that maps a code to its household and cannot be listed either. Inside one household sit five data collections - meals, suggestions, people, votes and weeks - plus two gate collections drawn in the rules' own colour: members, one document per admitted device, and private/join, holding the invite code that only members may read." width="100%">
</picture>

Two products are switched on and the rest are deliberately off:

| Product | State | Why |
|---|---|---|
| Cloud Firestore | on | the shared data, with realtime listeners |
| Anonymous Authentication | on | gives every visitor an identity without an account |
| Firebase Hosting | **off** | GitHub Pages serves the app |
| Cloud Functions | **off** | there is no server-side logic |

**Anonymous auth** means nobody signs up and nobody has a password. On first load the SDK silently mints an identity for that browser and hands back a token. It exists so the rules have something to check - it is not a login, and it does not identify a *person*. Which family member a phone is picking as is a separate thing entirely, chosen from the roster and remembered in that device's `localStorage`.

An anonymous identity on its own buys nothing, though. See below.

### Who gets in

The site is public and always will be - GitHub Pages has no other setting, and making the repo private would only hide the source, not the URL.
So the gate is in the data, not in the hosting.

Three things do the work:

- The **household id** is 20 random characters, so it cannot be guessed and two families with the same surname never meet.
- The **invite code** is what admits a device. It lives in `households/<hid>/private/join`, readable only by devices already in that family.
- **`invites/<code>`** is a lookup from a code to the household it opens, and nothing more. It can be fetched by id but never listed, so holding a code is the whole of the permission.

The sequence on a cold phone joining:

1. Firebase mints an anonymous uid.
2. The typed code is normalised, and the app reads `invites/<code>`. Missing means *"No family uses that code"* - a real error rather than a silent empty list.
3. The code goes up with a write to `households/<hid>/members/<uid>`. The page never checks it; the rules compare it against `private/join`, which the phone cannot read until that write has succeeded. Rejected means the code was replaced since the invite was found.
4. It matches, the member document is created, and the app connects. It never asks again on that phone.

Every data collection is gated on that member document existing, not on the code.
So a new code changes nothing for phones already in, because their membership is the document.

Starting a family is one batched write of four documents: the household, `private/join`, the invite, and the creator's own membership.
The rules refuse the household unless all four arrive together, so no family can exist half made, with nobody in it, or with no way to invite anyone.
The code must be 10 characters from the code alphabet; the rules check that too, because they cannot count attempts and so the code has to be unguessable instead.

The rules do not distinguish between members.
Anyone in a family can edit its meals, change its code, remove a phone, or delete it - the intended shape for a household.
`MANAGE_PIN` in `index.html` is still only a UI gate: it keeps the Manage tab off the kids' phones and defends nothing, and it is the same for every family.

The uid lives in the browser's IndexedDB, so clearing site data means joining with the code once more.

### What a write may carry

Strangers now hold valid tokens, so every data collection names the fields a document may have (`keys().hasOnly`) and bounds each one.
Lists are checked to be lists of strings, bounded in count and in total length.
That stops anyone padding a document to a megabyte under a field nobody reads, or storing a value that would break the page for the rest of their family.

A meal's `icon` is the one field drawn as a glyph rather than as text, and it once went into the page unescaped, which let anyone in a family run script on everyone else's phone by setting an icon to markup.
The page now escapes it like everything else, and the rules refuse `<`, `>`, `&` and `"` in it as a second lock.

### The family from before invites

`charge` predates all of this: its id is a surname slug, and its code was short with no `invites` document.
Nothing treats it specially.
Its phones are members like any other, and the first time one of them opens an invite, the app replaces the short code with a strong one and creates its invite.
Until that happens, a new phone has no code it can join `charge` with.

### Leftovers from the migration

> **One-time. Delete this section once it is done.**

Before the household gate, everything lived in top-level `meals`, `suggestions`, `people`, `votes` and `weeks` collections. The migration copied all 62 documents into `households/charge/` and left the originals in place deliberately, as a fallback while phones were still joining. Nothing reads them now.

Once every phone has joined and is working, remove them: **Firestore → Data**, then for each of those five collections, open it and use **Delete collection**.

Leave `households` alone - that is the live data.

### Deploying the rules

```bash
mise run rules-test     # every rule, against the local emulator
mise run rules-deploy   # publish firestore.rules to the live project
```

Pushing to GitHub does not change the rules; `rules-deploy` does.
It needs `firebase login` once on the machine, and nothing else - no service account key is stored anywhere.
Publish rules before the page that depends on them; the rules here are written to stay compatible with the page that is live while they go out.

`create`/`update` and `delete` are written as separate clauses on purpose: a delete carries no `request.resource`, so a single combined rule with a field check silently blocks every delete - removing a meal, dismissing a suggestion, clearing a week.

### Free tier

1 GiB of storage, 50,000 reads and 20,000 writes per day, and anonymous sign-in at no cost.
A family of five voting weekly is nowhere near any of those.

The daily limits are shared by every family on the project.
Opening the app costs roughly one read per meal, person and vote, so on the order of a hundred, and the reads run out at around 500 opens a day.
Past that the app keeps working from its cached copy until the daily reset; nothing is billed, because the free plan has no card on it.
Moving to the pay-as-you-go plan is the fix if it ever comes to that.

### Recreating it from scratch

1. Create a Firebase project (skip Analytics).
2. **Firestore Database → Create database**, production mode, any US region.
3. **Authentication → Sign-in method → Anonymous → Enable.**
4. **Project settings → Your apps → `</>`** and copy the config into `FIREBASE_CONFIG` in `index.html`.
5. Put the project id in `.firebaserc`, then `firebase login` and `mise run rules-deploy`.
6. Restrict the web API key: **Google Cloud Console → APIs & Services → Credentials**. Application restrictions → Websites → the Pages origin. API restrictions → only Identity Toolkit, Token Service, Cloud Firestore and Firebase Installations.

No household needs creating by hand; the first one is started from the app.

## Firestore data model

Everything hangs off a household, so the app touches only two top-level collections:

| Path | Document id | Holds |
|---|---|---|
| `invites` | the invite code | `hid`, `createdAt`. `get` for any signed-in device; **`list` is denied**. Created only alongside the household's real code, and replaced whenever the code is |
| `households` | 20 random characters (`charge` is a surname slug from before) | `name`, `createdBy`, `createdAt`. `get` is allowed so a joining phone can show the family's name; **`list` is denied**, so the ids cannot be enumerated |
| `households/<hid>/private` | `join` | one field, `code`. Readable by members only; written only with its invite. Any other document under `private/` is closed to every client |
| `households/<hid>/members` | anonymous uid | `code`, `joinedAt`. One per admitted device; never editable. Deleted to leave, or by another member to remove a phone |
| `households/<hid>/meals` | slug of the name | the master list. Optional `icon` field overrides the matched emoji; optional `ingredients` array of up to 20 strings feeds the grocery list |
| `households/<hid>/suggestions` | slug of the name | typed-in meals awaiting keep or dismiss |
| `households/<hid>/people` | slug plus a random suffix | the household roster |
| `households/<hid>/votes` | `<weekId>__<personId>` | one document per person per week, holding an array of meal ids |
| `households/<hid>/weeks` | `<weekId>` | the meals locked into that week's plan |

`allow list: if false` on `households` and on `invites` are the most load-bearing lines in `firestore.rules`.
Without the first, one query returns every household id in the project; without the second, every code.

`weekId` is the Sunday of the week, as `YYYY-MM-DD`.

A suggestion is given the same id its meal will have, so approving one is a copy across collections and existing votes keep pointing at the right thing.

One document per voter per week means two phones never contend on the same write, which matters because Firestore is last-writer-wins with no transactions.

## Layout

The app is a single static file, `index.html`, with no build step - open it and it works.
`package.json` holds the test and deploy tooling only; nothing in it ships to a phone.

```
index.html            the whole app
site.webmanifest      home-screen name and icons
firestore.rules       the security rules; mise run rules-deploy publishes them
firebase.json         emulator ports and the rules file, for tests and deploys
tests/rules.test.mjs  every rule against the emulator, negative cases first
tests/e2e/            two- and three-phone browser tests, and screenshots
tests/serve.mjs       a static server that behaves like GitHub Pages
icons/                home-screen and favicon PNGs, generated from icon.typ
diagrams/             Typst sources and rendered SVGs
  design/             palette and tokens shared by every diagram
```

## Testing

```bash
npm install                    # once
npx playwright install chromium # once
mise run rules-test            # security rules against the Firestore emulator
mise run e2e                   # phones in a browser against the emulators
```

`mise` installs the Java the emulator needs, locally to this project.
Both suites run against the Firebase emulators under the throwaway project id `demo-dinner-decisions`, so no test ever touches a real family.
The page joins the emulators only when served from `localhost` with `?emu=1`; the live site cannot take that path.
The browser tests write screenshots of every screen, light and dark, at two phone widths, to `test-results/screens/`.
GitHub Actions runs both suites on every push.

The emulators use ports 8181 and 9199 rather than the defaults, which other local projects tend to hold.

## Configuration

Two things in `index.html`:

- `FIREBASE_CONFIG` - the web app config from the Firebase console. The `apiKey` is not a secret; it identifies the project, and it ships to every browser that loads the page whatever the repo's visibility. It is restricted in Google Cloud to the Pages origin, and access to the data is controlled by the security rules. GitHub's secret scanner flags it anyway, because it cannot tell a Firebase browser key from a server-side Google key.
- `MANAGE_PIN` - the code that reveals the Manage tab, the same for every family and shown inside Manage so a second parent can unlock it. It hides Manage from the kids' phones. It is **not** security: it sits in the page source of a public repo, so anyone who opens dev tools can read it.

And two things that are deliberately **not** here:

- **Invite codes** live in Firestore, never in the source, and are generated on the phone with the browser's cryptographic random generator.
- The **household** a phone belongs to is chosen in the app and kept in that device's `localStorage`, so the same `index.html` serves every family without knowing about any of them.

## Regenerating

```bash
mise run render   # diagrams → dual-theme SVGs
mise run icons    # home-screen and favicon PNGs
```

Diagrams need `typst` and the **CaskaydiaMono NFP** font. Each source compiles once per theme, and the fixed pt dimensions are stripped so the SVGs scale to the README's width. Icons need a colour emoji font - Segoe UI Emoji on Windows, Apple Color Emoji on macOS - and compile at 72 ppi so the page size in points equals the pixel size exactly.

The first `mise` run in a fresh clone needs `mise trust`.
