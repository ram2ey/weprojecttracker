# Android app (Google Play)

The Play Store app is a **Trusted Web Activity (TWA)**: a small Android app that opens this website in Chrome with no address bar. There is no separate app code to keep in step. Website releases reach the app straight away; a new app build is needed only to change the icon, name, start address or Android settings.

Decisions behind the app's scope are in the Phase 0 notes and the user's choices of 10 and 17 November 2026: projects and news only; tabs News · Projects · Saved · More; push notifications in the first release; a Report button on comments; an offline page.

## How the website behaves inside the app

- **App mode.** The app opens `/news?app=android`. A small inline script in the public layout (`src/lib/app-mode.ts`) notices the marker, or Chrome's `android-app://<package>` referrer for links opened in the app, and sets `<html data-app="android">`. CSS then hides the website menu, footer, Install button and download banner and shows the bottom tab bar (`src/components/app-shell.tsx`). App mode is kept in `sessionStorage`, not a cookie: the app shares cookies with Chrome, so a cookie would turn the visitor's ordinary Chrome tabs into the app layout.
- **Hidden pages.** The homepage redirects to News inside the app. About and FAQ still open if someone follows a shared link, with the tab bar, but nothing in the app links to them. Contact hides its FAQ block. Mark website-only elements with `web-only` and app-only elements with `app-only`.
- **More tab** (`/more`): updates, notification settings, call/WhatsApp/contact details, Privacy and Cookie settings. Not linked from the website.
- **News list** (`/news`): all stories, 12 per page. Linked only from the app; it is in the sitemap.
- **Offline page.** `public/notification-sw.js` is now registered for every visitor. It stores only `/offline.html` and the logo, and serves that page when a page load fails. It reloads automatically when the connection returns. Pages, projects, news and comments are never cached. The offline page has its own strict CSP in `next.config.ts`; the script hash there must match the file (a unit test checks it).
- **Comment reports.** Each comment has a Report button with an optional reason. Reports never hide a comment: Admins see "Reported comments" in Comments, then hide the comment or keep it ("dismiss reports"). One report per browser per comment; no IP address is stored. Google Play requires in-app reporting for apps with user posts.

## Website association (Digital Asset Links)

`/.well-known/assetlinks.json` is generated from two Coolify environment variables, and returns 404 until both are valid:

| Variable                    | Value                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANDROID_PACKAGE_NAME`      | The app's package name, for example `com.wassaeast.projects` (permanent once published)                                                                                                   |
| `ANDROID_CERT_FINGERPRINTS` | SHA-256 signing fingerprints, comma separated: the **Play App Signing** key from Play Console › Test and release › App integrity, plus the upload key while testing locally signed builds |

Changing them needs a restart, not a rebuild. Check the result with Google's [Statement List tester](https://developers.google.com/digital-asset-links/tools/generator). If the association fails, the app still opens but shows a browser bar.

## Building the app (step 2)

Use [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) with the live manifest (`https://wassaeastprojecttracker.com/manifest.webmanifest`). Settings that differ from Bubblewrap's defaults:

- Start URL: `/news?app=android`
- Package name: the value chosen for `ANDROID_PACKAGE_NAME`
- `enableNotifications: true`, so web push is shown as the app's notifications (Android 13+ asks permission on the first "Turn on notifications" tap)
- A white-on-transparent monochrome icon for the status bar (`monochromeIconUrl`); this does not exist yet
- Target the current Play target SDK (API 36 when checked in November 2026)

Keep the generated Android project in the repository, but **never** commit the keystore or its passwords: add `*.jks`, `*.keystore` and `keystore.properties` to `.gitignore` before generating the key, and store the key and passwords in the password manager.

Test on a phone installed from Play's internal testing track, not only a locally signed APK, because the Play App Signing fingerprint differs from the upload key.
