# Decisions and open work

The product decisions behind this project, and the work that is still open. They are recorded here so they move with the code, whichever machine is used. Newest first within each section.

When a decision changes, update its entry and give the new date. Don't delete the old reasoning without replacing it.

## Current status (23 Nov 2026)

- The website is live at https://wassaeastprojecttracker.com and deploys automatically when changes are merged into `main` ([AUTOMATIC_DEPLOYMENT.md](AUTOMATIC_DEPLOYMENT.md)).
- Step 1 of the Google Play app (the website side) is live: PR #28, plus PR #29 for the release tag fix.
- Step 2, the Android build with Bubblewrap, has not started. See [Open work](#open-work).

## Decisions

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

Waiting on two answers from the office:

1. **The permanent package name**, for example `com.wassaeast.projects`. It can never change after the first upload.
2. **Whether the Google Play developer account is personal or an organisation.** New personal accounts must run a closed test with testers before they can publish.

Then:

- build the app with Bubblewrap, using the settings in [ANDROID_APP.md](ANDROID_APP.md);
- set `ANDROID_PACKAGE_NAME` and `ANDROID_CERT_FINGERPRINTS` in Coolify, using the Play App Signing SHA-256 fingerprint. Until both are set, `/.well-known/assetlinks.json` returns 404;
- complete the store listing and Data safety form ([GOOGLE_PLAY_SUBMISSION_PLAN.md](GOOGLE_PLAY_SUBMISSION_PLAN.md)).

**The upload key (keystore) must be backed up to at least two places on the day it is created and must never be committed.** Losing it can block app updates.

### Release reliability (offered 18 Nov 2026, not started)

Each of these blocked a release on 17 Nov until someone used "Re-run failed jobs". Re-running is safe since PR #29, but it costs time.

1. **Keep the PostgreSQL signing key in the repo.** The `tools` image downloads `https://www.postgresql.org/media/keys/ACCC4CF8.asc` on every build (Dockerfile, `tools` stage). That download failed twice on 17 Nov. Commit a copy after checking its fingerprint and copy it into the image. Packages still come from apt.postgresql.org.
2. ~~Fix the intermittent browser tests.~~ Done 23 Nov 2026. The test server now keeps idle connections open, ending the dropped connection (ECONNRESET) errors, and the notification settings test waits for the save before reloading.
