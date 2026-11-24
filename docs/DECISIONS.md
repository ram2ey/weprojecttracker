# Decisions and open work

The product decisions behind this project, and the work that is still open. They are recorded here so they move with the code, whichever machine is used. Newest first within each section.

When a decision changes, update its entry and give the new date. Don't delete the old reasoning without replacing it.

## Current status (24 Nov 2026)

- The website is live at https://wassaeastprojecttracker.com and deploys automatically when changes are merged into `main` ([AUTOMATIC_DEPLOYMENT.md](AUTOMATIC_DEPLOYMENT.md)).
- Step 1 of the Google Play app (the website side) is live: PR #28, plus PR #29 for the release tag fix.
- Step 2, the Android build with Bubblewrap, is ready to start: the package name and account type are decided. See [Open work](#open-work).
- Release reliability fixes are done (PRs #31 and #32).

## Decisions

### Google Play app: package name and account (24 Nov 2026)

- **Package name: `com.wassaeast.projects`.** It is permanent once the first build is uploaded. It is also the value for `ANDROID_PACKAGE_NAME` in Coolify.
- **Play developer account: personal.** Google's rules for personal accounts created after 13 Nov 2023:
  - the app must run a **closed test with at least 12 testers opted in continuously for 14 days** before production access can be requested. Internal and open tests don't count, and production access is still a separate review ([Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465));
  - the developer name shown on the listing is the account holder's.
- *Note:* Google expects apps that are official government apps to be published from an organisation account with proof of authorisation. On a personal account, the listing and the app must not present it as an official government app, and should say who runs it and where its information comes from ([government information policy](https://support.google.com/googleplay/android-developer/answer/9514050)).

### Google Play app: step 1 details (17 Nov 2026)

- **Offline screen:** yes. A "You're offline" page appears only when a page fails to load. No project, news or comment content is stored on the phone.
- **Report button on comments:** it only flags a comment for review and never hides it. Each browser can report a comment once, with an optional reason (spam, abuse, private information, other). Admins see **Reported comments** and choose Hide comment or Keep comment (dismiss reports). Dismissals are recorded in the audit log.
  - *Why:* Google Play requires in-app reporting for apps that show user posts.
- **`/news` page:** open to everyone and in the sitemap, so shared links and search work. Only the app's tab bar links to it, and the website menu is unchanged.
- **Pages hidden in the app:** the homepage sends app users straight to News. About and FAQ still open from a shared link, but the app doesn't link to them.
- **App header:** a slim bar with the logo and the Updates bell. No menu button and no Install button. Notification settings are under More.

### Google Play app: scope and navigation (10 Nov 2026)

- The app covers **projects and news only**. The website itself is unchanged.
- It uses a bottom tab bar, **News · Projects · Saved · More**, and opens on News. More holds Updates, Contact and Privacy. Privacy must stay reachable for Google Play.
- Not shown in the app:
  - the homepage hero and "Meet Wassa East";
  - the About page;
  - the MP profile and constituency executives;
  - FAQ;
  - footer social links;
  - the "Browse by community" grid (the project filters still include community);
  - the Install App button and the download banner.
- **App mode is never stored in a cookie.** The app shares cookies with Chrome on the phone, so a cookie would switch the visitor's normal Chrome tabs to the app layout too. App mode is kept for the current tab only (`sessionStorage`). It switches on when the app opens `/news?app=android` or when Chrome reports that the visit came from the app. Details are in [ANDROID_APP.md](ANDROID_APP.md).
- *Why:* a focused app rather than a copy of the full website.

### Single Admin role (12 Nov 2026)

- Every staff account is **Admin** with every permission. There is no separate editor, approver or operator.
- An Admin may **publish their own work** without a second reviewer. Migration 0012 converted the old roles, and the stored value is still `super_admin`.
- Don't bring back role pickers, second-reviewer checks or "approver" wording. New permission checks go through `canSubmit`, `canApprove` and `canManageStaff` in `src/lib/security/policy.ts`.
- *Why:* a small office team, and the two-person review was slowing publishing.

### Notifications: everything by default (12 Nov 2026)

- The Updates feed and bell are open to every visitor, with no sign-up.
- One tap on "Turn on notifications", followed by the browser's own permission prompt, subscribes the phone to all project updates and news. There are no per-project, category or community Follow buttons. Settings can turn off news or individual categories.
- First-time visitors see a small invite banner instead of a browser prompt. Dismissing it hides it for 30 days.
- When an Admin approves a change, the "alert subscribers" box is ticked by default. Untick it for small corrections, because every approval can notify everyone.
- Don't bring back Follow buttons or a separate news sign-up unless the office asks for them.
- *Why:* every extra step reduces how many people sign up. Browsers still require one tap to grant permission.

### Push notifications in the first app release (10 Nov 2026)

- Push notifications ship with the first Google Play release, not a later update. This reverses the 5 Nov decision that removed push.
- The website notification system (12 Nov, above) is what the app uses.

## Open work

### Android app, step 2: build and submit

Package `com.wassaeast.projects` on a personal Play account (decided 24 Nov 2026, above). The build will be done on the office's other laptop, which already builds Android apps, so some tools may be installed there already.

**Before starting (the account holder):**

- **Play Console account ready:** the fee is paid and identity and phone verification are complete. Identity checks can take days.
- **App name:** the website's install details use **"Wassa East Projects"**, with **"Wassa East"** under the icon. Use these unless the office decides otherwise.
- **Two backup places for the signing key**, for example the password manager plus a USB stick.
- **Start recruiting testers:** at least 12, ideally 15 or more, with Android phones and the Gmail addresses they use for Play.

**Build tools needed:**

| Tool | Approx. disk space |
|---|---|
| Java 17 (JDK) | ~320 MB |
| Android command-line tools | ~200 MB |
| Android build tools and the API 36 platform | ~300 MB |
| Gradle and its cache | ~0.7–1.2 GB |
| Bubblewrap (npm) | ~50 MB |

Total: about 1.5–2.5 GB. Android Studio and an emulator are not needed; test on a real phone from the internal testing link. Check what is already installed first (`java -version`, `ANDROID_HOME`, `~/.bubblewrap/config.json`). Bubblewrap can point at an existing JDK and SDK.

**The person holding the signing key creates it in the terminal**, typing passwords generated in the password manager. Passwords never go into chat, the repo or Coolify.

**Steps:**

1. **Set up the build machine:** JDK 17 and the Android SDK (Bubblewrap can install both).
2. **Build** the app with Bubblewrap, using the settings in [ANDROID_APP.md](ANDROID_APP.md). This creates the upload key; back it up the same day (below).
3. **Create the app in Play Console** with that package name, and upload the first build to the internal test track. Play Console then shows the Play App Signing SHA-256 fingerprint.
4. **Set `ANDROID_PACKAGE_NAME=com.wassaeast.projects` and `ANDROID_CERT_FINGERPRINTS`** in Coolify, using that fingerprint, and redeploy. Check that `/.well-known/assetlinks.json` now returns the statement and that the app opens without a browser address bar. Until both are set, the file returns 404.
5. **Recruit at least 12 testers** with Android phones and Google accounts, and start the closed test. Keep at least 12 opted in for 14 days in a row.
6. **Meanwhile:**
   - complete the store listing (with who runs the app and where its information comes from), screenshots, content rating, target audience, Data safety form and government-app declaration ([GOOGLE_PLAY_SUBMISSION_PLAN.md](GOOGLE_PLAY_SUBMISSION_PLAN.md));
   - fix what testers report.
7. **Apply for production access** after the 14 days, then submit the production release.

**The upload key (keystore) must be backed up to at least two places on the day it is created and must never be committed.** Losing it can block app updates.

### Release reliability (done 24 Nov 2026)

Each of these blocked a release in mid-November until someone used "Re-run failed jobs". Re-running is safe since PR #29.

1. ~~Keep the PostgreSQL signing key in the repo.~~ Done 24 Nov 2026. `docker/postgresql-ACCC4CF8.asc` is the key from postgresql.org, checked against the Ubuntu keyserver copy and the published fingerprint `B97B 0AFC AA1A 47F0 44F2 44A0 7FCC 7D46 ACCC 4CF8`. It has no expiry date. The `tools` image copies it in instead of downloading it, and no longer installs curl or gnupg. Packages still come from apt.postgresql.org. If PostgreSQL ever replaces the key, apt will refuse the repository and the build will fail clearly; then download the new key, check its fingerprint against https://wiki.postgresql.org/wiki/Apt and replace the file.
2. ~~Fix the intermittent browser tests.~~ Done 23 Nov 2026 (PR #31):
   - the test server keeps idle connections open, ending the dropped connection (ECONNRESET) errors;
   - the notification settings test waits for the save before reloading;
   - the retirement worker test waits for the page's offline worker to register first.
