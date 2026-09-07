# Dinner Decisions

A one-page dinner picker for the family.
Everyone opens the same link on their own phone, taps the meals they'd be happy to eat this week, and whoever does the shopping sees a live tally.

**→ [superrcharge.github.io/dinner-decisions](https://superrcharge.github.io/dinner-decisions/)**

No accounts to create, nothing to install. Any phone, any browser.

The link is public, so the first time the app runs on a phone it asks for two things: the family surname and a code.
That is once per device, not once per visit - enter them and that phone is remembered for good.
Anyone who finds the URL without both gets a page that will not load anything.

## How it works

- **Pick meals** - tap tiles to vote. Everything you've chosen is gathered into a **Your picks** strip at the top, so you can read your own selections back without hunting for green tiles. Type anything that isn't on the list and it joins that week's options straight away.
- **Shopping** - meals ranked by votes, with who picked each one and who hasn't voted yet. Build the week's plan by tapping *Add*.
- **Manage** - hidden behind its own separate code, not the family one. Edit the master meal list, keep or dismiss what the kids suggested, set a meal's icon, list what a meal needs, clear the week.

The tab strip sticks to the top of the screen, so the three views stay reachable however far down the list you've scrolled.

The week rolls over on its own every Sunday. Nobody has to reset anything.

**First time on a phone:** tap **Choose** in the top right, enter the family name and code, then pick your name from the list that appears. All of it is remembered on that device, so it is a one-time step.

The same menu shows the current family afterwards, with a **Change** link if a phone ever needs to move to a different one.

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
  <img src="./diagrams/firebase-light.svg" alt="Firebase: Anonymous Auth issues a token to the security rules, which gate every read and write into Cloud Firestore. Everything nests under a households collection whose ids cannot be listed. Inside one household sit five data collections - meals, suggestions, people, votes and weeks - plus two gate collections drawn in the rules' own colour: members, one document per admitted device, and private/join, holding the code that only a rule may read." width="100%">
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

The site is public and always will be - GitHub Pages has no other setting, and making the repo private would only hide the source, not the URL. So the gate is in the data, not in the hosting.

Two values do the work, and they cover different failures:

- The **household id** is a slug of the surname, so `Charge` becomes `charge`. It has to be guessable, because that determinism is the only way a second phone finds the same list. It grants nothing on its own.
- The **code** is what admits a device. It lives in `households/<hid>/private/join`, a document the rules deny to every client in both directions.

A rule's own `get()` is not subject to the rules, so the code can be compared against a value the browser can never fetch. That is the only way a static site served from a public repo can hold a secret at all.

The sequence on a cold phone:

1. Firebase mints an anonymous uid.
2. The typed surname is slugged, and the app reads `households/<hid>`. Missing means *"No family by that name"* - a real error rather than a silent empty list.
3. The typed code goes up with a write to `households/<hid>/members/<uid>`. The page never checks it; the rules do. Rejected means *"Not that code"*.
4. It matches, the member document is created, and the app connects. It never asks again on that phone.

Every data collection is gated on that member document existing, not on the code. Two consequences worth knowing:

**Changing the code** - edit `private/join` in the console. New devices need the new code; phones already in are untouched, because their membership is the document, not the code.

**Revoking a phone** - delete its `members` document. Nothing it does afterwards is permitted. The rules deny `update` and `delete` there, so a device can neither edit its own record nor undo a revocation.

The uid lives in the browser's IndexedDB, so clearing site data means entering both values once more.

Neither value is in `index.html`. `MANAGE_PIN` still is, and is still only a UI gate - it hides the Manage tab from the kids, it does not defend anything. That is a reasonable place to leave it, because everyone who can reach Manage at all already had the family code.

### Adding another family

One deployment serves any number of households. Adding one is two documents and no code change.

**It can only be done from the Firebase console.** The rules carry `allow write: if false` on `households`, so no client may create one - not the app, not a snippet in dev tools on the live site. The console's Data tab writes with admin credentials and bypasses security rules entirely, which is why it is the one place this works. A `permission-denied` from anywhere else is the rule doing its job, not a bug.

That restriction is also what makes *"No family by that name"* possible: because households only ever exist deliberately, a surname that does not resolve is a real error rather than an invitation to create one.

**Firestore → Data:**

1. Click `households` → **Add document**. Document ID is the slug of their surname. Add one field, `name`, type string, holding the display name. **Save**.
2. Click the document you just made → **Start collection**. Collection ID `private`, Document ID `join`. Add one field, `code`, type string, holding their code, lowercase. **Save**.

That is all. The five data collections appear on their own as that family uses the app.

Tell them their surname and code. They open the same URL, tap **Choose**, enter both, and start with an empty list they build themselves. Their data is invisible to yours and yours to theirs.

**Getting the slug right.** The app lowercases the typed surname and turns every run of non-alphanumerics into a single hyphen, so `O'Brien` resolves to `o-brien` and `Van Dyke` to `van-dyke`. The document ID has to match what that produces, or their surname will not resolve.

**Why there is no script for this.** Automation would have to come in above the rules, which means admin credentials. The Admin SDK route puts a long-lived, full-power service account key on a laptop to save six clicks; the REST route avoids the stored key only by requiring the gcloud CLI, which is more tooling than the thing it replaces. Both are a bad trade for a task done roughly never. If it ever became frequent the answer would not be a script but letting families create their own household - a rules and UI change that costs the clean "no such family" error above.

### Leftovers from the migration

> **One-time. Delete this section once it is done.**

Before the household gate, everything lived in top-level `meals`, `suggestions`, `people`, `votes` and `weeks` collections. The migration copied all 62 documents into `households/charge/` and left the originals in place deliberately, as a fallback while phones were still joining. Nothing reads them now.

Once every phone has joined and is working, remove them: **Firestore → Data**, then for each of those five collections, open it and use **Delete collection**.

Leave `households` alone - that is the live data.

### Deploying the rules

> **`firestore.rules` is not deployed by anything.**
> The file in this repo is the source of truth for humans, but pushing it changes nothing. The rules only take effect when pasted into **Firebase console → Firestore → Rules → Publish**. Edit the file and the console together, or they will drift.

The rules require an admitted device - not merely an authenticated one - and confine writes to the five data collections inside one household. `create`/`update` and `delete` are written as separate clauses on purpose: a delete carries no `request.resource`, so a single combined rule with a field check silently blocks every delete - removing a meal, dismissing a suggestion, clearing a week.

They do not distinguish between members. Anyone holding the code can edit that household's meal list, which is the intended shape for a family.

### Free tier

1 GiB of storage, 50,000 reads and 20,000 writes per day, and anonymous sign-in at no cost. A family of five voting weekly is nowhere near any of those.

### Recreating it from scratch

1. Create a Firebase project (skip Analytics).
2. **Firestore Database → Create database**, production mode, any US region.
3. **Authentication → Sign-in method → Anonymous → Enable.**
4. **Project settings → Your apps → `</>`** and copy the config into `FIREBASE_CONFIG` in `index.html`.
5. Create the first household as described in [Adding another family](#adding-another-family). Do this *before* publishing the rules - without it every join fails.
6. Paste `firestore.rules` into the console and publish.
7. Restrict the web API key: **Google Cloud Console → APIs & Services → Credentials**, application restrictions → Websites → the Pages origin.

## Firestore data model

Everything hangs off a household, so the app touches no top-level collection but one:

| Path | Document id | Holds |
|---|---|---|
| `households` | slug of the surname | `name`. `get` is allowed so the app can say "no family by that name"; **`list` is denied**, so the ids cannot be enumerated |
| `households/<hid>/private` | `join` | one field, `code`. Denied to every client in both directions; only a rule's own `get()` reads it |
| `households/<hid>/members` | anonymous uid | one per admitted device. Delete one to revoke that phone |
| `households/<hid>/meals` | slug of the name | the master list. Optional `icon` field overrides the matched emoji; optional `ingredients` array of up to 20 strings feeds the grocery list |
| `households/<hid>/suggestions` | slug of the name | typed-in meals awaiting keep or dismiss |
| `households/<hid>/people` | slug plus a random suffix | the household roster |
| `households/<hid>/votes` | `<weekId>__<personId>` | one document per person per week, holding an array of meal ids |
| `households/<hid>/weeks` | `<weekId>` | the meals locked into that week's plan |

`allow list: if false` on `households` is the single most load-bearing line in `firestore.rules`. Without it one query returns every household id in the project, and a deliberately guessable id becomes a harvestable list.

`weekId` is the Sunday of the week, as `YYYY-MM-DD`.

A suggestion is given the same id its meal will have, so approving one is a copy across collections and existing votes keep pointing at the right thing.

One document per voter per week means two phones never contend on the same write, which matters because Firestore is last-writer-wins with no transactions.

## Layout

Single static file, `index.html`. No build step, no dependencies to install, nothing to run locally - open it and it works.

```
index.html          the whole app
site.webmanifest    home-screen name and icons
firestore.rules     reference copy; paste into the console to apply
icons/              home-screen and favicon PNGs, generated from icon.typ
diagrams/           Typst sources and rendered SVGs
  design/           palette and tokens shared by every diagram
```

## Configuration

Two things in `index.html`:

- `FIREBASE_CONFIG` - the web app config from the Firebase console. The `apiKey` is not a secret; it identifies the project, and it ships to every browser that loads the page whatever the repo's visibility. It is restricted in Google Cloud to the Pages origin, and access to the data is controlled by the security rules. GitHub's secret scanner flags it anyway, because it cannot tell a Firebase browser key from a server-side Google key.
- `MANAGE_PIN` - the code that reveals the Manage tab. It hides Manage from the kids' phones. It is **not** security: it sits in the page source of a public repo, so anyone who opens dev tools can read it.

And two things that are deliberately **not** here:

- The **family code** lives in Firestore at `households/<hid>/private/join`, never in the source. That is the whole point - it is the one value that must not be readable, and a static site served from a public repo cannot keep a secret in its own source.
- The **household** a phone belongs to is chosen in the app and kept in that device's `localStorage`, so the same `index.html` serves every family without knowing about any of them.

## Regenerating

```bash
mise run render   # diagrams → dual-theme SVGs
mise run icons    # home-screen and favicon PNGs
```

Diagrams need `typst` and the **CaskaydiaMono NFP** font. Each source compiles once per theme, and the fixed pt dimensions are stripped so the SVGs scale to the README's width. Icons need a colour emoji font - Segoe UI Emoji on Windows, Apple Color Emoji on macOS - and compile at 72 ppi so the page size in points equals the pixel size exactly.

The first `mise` run in a fresh clone needs `mise trust`.
