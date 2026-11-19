# Content ratings and audience (draft)

Dinner Decisions is a general-audience household tool, made for adults running a home.
Family members of any age may tap their own votes on a phone in the household, but the app is not made for children and is never listed or marketed to them.
Answer every questionnaire honestly with that in mind.

## Google Play: Target audience and content

| Question | Answer |
|---|---|
| Target age groups | **18 and over** only |
| Could your store listing unintentionally appeal to children? | No: no cartoon characters, games, child-directed language or imagery; it is a meal planner for a household |
| Join the Designed for Families program? | No |
| Teacher Approved | No |

Choosing 18+ keeps the app out of the Families policy, which would restrict SDKs and links out (the plan's "Not a children's app" decision).

## Google Play: IARC content rating questionnaire

**Category:** "All Other App Types" (a utility, not a game, not social or communication-first).

| Topic | Answer | Why |
|---|---|---|
| Violence, blood, fear | No | |
| Sexuality, nudity | No | |
| Language (profanity, crude humor) | No | Meal names are typed by the family, but the app has none of its own |
| Controlled substances (drugs, alcohol, tobacco) | No | |
| Gambling, simulated gambling | No | |
| Does the app let users interact or exchange content with each other? | **Yes** | Names, meals and suggestions are shared with the other phones in the same family. Only phones holding the family's invite code are in it; there are no strangers, profiles, chat or messaging. |
| Does the app share the user's current physical location? | No | |
| Does the app allow purchases of digital goods? | No | (Revisit when Plus is added to the apps.) |
| Is the app a web browser or search engine? | No | |
| Is it primarily news or educational? | No | |

Expected result: Everyone / PEGI 3 / USK 0, possibly with the "Users Interact" descriptor.

## Apple: Age rating

Apple's current questionnaire (in App Store Connect, under App Information, Age Rating).

| Topic | Answer |
|---|---|
| Cartoon or fantasy violence, realistic violence, prolonged graphic violence | None |
| Profanity or crude humor | None |
| Mature or suggestive themes, horror or fear themes | None |
| Sexual content or nudity, graphic sexual content | None |
| Alcohol, tobacco or drug use or references | None |
| Simulated gambling, contests | None |
| Medical or treatment information, health or wellness topics | None |
| Unrestricted web access | No (links open only our own pages and the phone's mail or share sheet) |
| User-generated content | **Yes**, shared only within the family that joined with the invite code |
| Messaging and chat | No |
| Advertising | No |
| Parental controls, age assurance | No, not in the app (the Manage code is a convenience, not a parental control) |
| Gambling | No |
| Made for Kids | No |

Expected result: **4+**.
If App Store Connect raises the rating because of the user-generated content answer, accept it; do not answer No to lower it.

## Age-assurance laws (before public release)

Status checked on Nov 18, 2026 (law-firm summaries, not legal advice):

| Law | Status | From |
|---|---|---|
| Texas SB 2420 | Enforceable: the Fifth Circuit stayed the injunction in June 2026; appeal argued Aug 2026, no ruling yet | Now |
| California AB 1043 | Signed; developers must request the OS or store age signal | Jan 1, 2027 |
| Utah (amended) | Main duties delayed | May 6, 2027 |
| Louisiana HB 977 (replaces HB 570) | Narrowed to relying on store signals | Jul 1, 2027 |

What the apps do (`checkAgeSignals` in `index.html`, plugin `@capawesome/capacitor-age-signals`):

- Android asks Google Play's Age Signals API each time the app opens or comes back.
  iPhone first asks Apple whether age assurance applies to this person, and only then asks Declared Age Range (ages 13, 16, 18), so nobody else sees Apple's prompt.
- The answer stays in memory on the phone; it is not stored or sent anywhere.
- The app holds (a screen that cannot be closed) only when the store says a parent or guardian has declined approval; it lets go as soon as the store says approved.
  Any other answer, an error, or no store (a sideloaded copy) leaves the app as it is: the content is suitable for all ages, and the stores handle consent for the download itself.
- **Before ever declaring a "significant change"** in Play Console or shipping one on iPhone, add the iPhone acknowledgment and consent flow (`showSignificantUpdateAcknowledgment`, Apple's PermissionKit); the plugin does not do Apple's consent part.
- A lawyer should confirm this meets the developer's duties; the questions are in the HTML comment in `privacy.html` (Age signals in the apps).
