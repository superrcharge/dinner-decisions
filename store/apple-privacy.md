# Apple: App Privacy, privacy manifest and export compliance (draft)

Answers for App Store Connect, under App Privacy.
They must match the privacy policy at dinnerdecisions.app/privacy.html and the app's privacy manifest, `ios/App/App/PrivacyInfo.xcprivacy`.
If one changes, change all three.

## Data collection

**Do you or your third-party partners collect data from this app?** Yes.

Apple counts data as collected when it leaves the phone and is kept longer than it takes to answer the request.
The family's lists live in Google Firebase, so they count, even though only the family can see them.

| Data type (Apple's name) | What it is in Dinner Decisions | Used for | Linked to the user? | Used for tracking? |
|---|---|---|---|---|
| Contact Info: **Name** | First names on the family's "who is picking" list, and the first name stored with a suggestion | App Functionality | Yes | No |
| User Content: **Other User Content** | Family name, meals, icons, ingredients, suggestions, weekly votes and plan | App Functionality | Yes | No |
| Identifiers: **User ID** | The random anonymous id Firebase Authentication gives each phone | App Functionality | Yes | No |

Everything else is **Not collected**: email, phone number, address, payment info, contacts, location, photos, audio, browsing or search history, purchases, health, usage data, diagnostics, advertising data, device ID (Apple's "Device ID" means the advertising identifier, which the app never reads).

Why "Linked to the user" is Yes: the data is stored under the phone's anonymous id and the family, so it is connected to whoever uses that phone, even with no account.
Answering No here would be hard to defend; Yes costs nothing but a line on the label.

Why no Diagnostics or Usage Data: the app has no analytics or crash reporting, and we keep no logs (the privacy policy's "Technical information" section).
Google receives IP addresses to deliver the service, which Apple does not count as collection when it is used only to answer the request.

**Tracking:** No. The app does not track, has no tracking domains, and does not ask for App Tracking Transparency permission.

The label App Store Connect will then show:

- Data Linked to You: Contact Info, User Content, Identifiers.
- Data Used to Track You: none.

## Privacy manifest

`ios/App/App/PrivacyInfo.xcprivacy` declares the same three data types, no tracking, no tracking domains, and no required-reason APIs used by the app's own code.
Capacitor and its plugins ship their own manifests, which Xcode merges into the privacy report.
Before the first upload, open the build's privacy report in Xcode (Product, Archive, then Generate Privacy Report) on the GitHub Actions Mac and check that nothing unexpected appears.

## Account deletion (guideline 5.1.1(v))

Apple requires that an app which creates accounts lets people delete theirs inside the app.
Dinner Decisions has no accounts, but an anonymous sign-in plus a family is treated as one, so:

- **Delete My Data** is in the name menu (tap your name at the top) and in Manage, under Delete.
  It removes the phone from the family, deletes the name it picks as and that name's votes, deletes the anonymous sign-in, and clears the phone.
- **Delete this family** in Manage removes everything for everyone.
- The web page `https://dinnerdecisions.app/delete.html` explains both, and how to ask us when a phone is lost.

## Age range

The Declared Age Range answer is used only on the phone and never stored or sent, so it is not data "collected" for the privacy label.
The app's entitlements (`ios/App/App/App.entitlements`) include `com.apple.developer.declared-age-range` and Associated Domains; turn both capabilities on for the App ID `app.dinnerdecisions` in the Apple Developer account (Xcode's automatic signing does it on the first signed build).

## Export compliance

`ITSAppUsesNonExemptEncryption` is set to `NO` in `Info.plist`, so App Store Connect does not ask on every upload.
The app uses only the encryption built into iOS (HTTPS to Google), which is exempt.
If App Store Connect still asks: "Does your app use encryption?" Yes; "Does it qualify for any exemptions?" Yes, it only uses encryption within Apple's operating system (standard HTTPS).

## Other App Store Connect answers

| Question | Answer |
|---|---|
| Sign-in required to use the app? | No. Reviewers can start a family themselves; see `reviewer-notes.md`. |
| Content rights: does the app contain third-party content? | No. Families type their own meals. The meal icons are the phone's own emoji. |
| Advertising identifier (IDFA)? | No. |
| Made for Kids / Kids Category? | No. Do not choose the Kids Category: it bans links out and restricts the SDKs we need. |
| Price | Free. |
| Availability | United States only, to match the Terms. This also means no EU Digital Services Act trader declaration is needed; if the EU is ever added, declare trader status first. |
