# Google Play: Data safety form (draft)

Answers for Play Console, under App content, Data safety.
They must match the privacy policy at dinnerdecisions.app/privacy.html and `apple-privacy.md`.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS to Google Firebase) |
| Which of the following methods of account creation does your app support? | **Other**, described as: "No username, password or email. The app signs each phone in anonymously, and a phone joins a family with an invite code." |
| Account deletion URL | `https://dinnerdecisions.app/delete.html` |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | Yes: removing a name or a meal in the app, and the email route on the deletion page |
| Has your app successfully completed an independent security review (MASA)? | No |
| UPI payments | Not applicable |

Why "Other" rather than "My app does not allow users to create an account": Google treats an anonymous sign-in tied to stored data as an account for its deletion rule, and the plan is to meet the rule rather than argue it.
Delete My Data inside the app, and the deletion page, satisfy it.

## Data types

Mark each as **Collected**, **not Shared**.
Sharing with a service provider that processes data for us (Google Firebase) is not "sharing" in Google's terms.
None is processed ephemerally: all of it is stored until deleted.

| Category: data type | What it is | Required or optional | Purposes |
|---|---|---|---|
| Personal info: **Name** | First names on the family's "who is picking" list, and the first name stored with a suggestion | Required (choosing who is picking needs a name) | App functionality |
| App activity: **Other user-generated content** | Family name, meals, icons, ingredients, suggestions, weekly votes and plan | Required | App functionality |
| Device or other IDs: **Device or other IDs** | The random anonymous id Firebase Authentication gives each phone | Required | App functionality, Fraud prevention, security, and compliance (it is what the security rules check) |

Everything else: **not collected**.
That includes location, email, phone number, address, financial info, health, messages, photos and videos, audio, files, calendar, contacts, web browsing, app interactions, in-app search history, installed apps, crash logs, diagnostics, and advertising ID.

Notes for the reviewer field, if Play asks:

- No analytics, crash reporting or advertising SDKs are in the app.
- Vote reminders are local notifications scheduled on the phone; nothing about them is sent anywhere.
- Android's own backup may copy the app's local storage to the user's Google account; that is the user's backup, not data we collect.

## Other App content declarations

| Declaration | Answer |
|---|---|
| Privacy policy | `https://dinnerdecisions.app/privacy.html` |
| Ads | No, the app contains no ads |
| App access | All functionality is available without special access. A reviewer starts a family from the welcome screen. (Or give the reviewer invite code from `reviewer-notes.md`.) |
| Target audience and content | 18 and over only. See `content-rating.md`. |
| News app | No |
| COVID-19 contact tracing or status | No |
| Data safety | This file |
| Government app | No |
| Financial features | None |
| Health | No |
| Actions requiring exact alarms | Not declared: the app removes `SCHEDULE_EXACT_ALARM` from its manifest; reminders are inexact |
| Foreground service, full-screen intent, photo and video, all files access | Not used |
