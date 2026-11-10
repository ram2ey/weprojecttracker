# Browser installation

The public menu includes **Install App**. The app is named **Wassa East Projects**, with **Wassa East** as its short home-screen name. `/manifest.webmanifest` declares a standalone launch at `/`, the app ID/scope, theme and icons. Apple web-app metadata and a 180px touch icon support iPhone home-screen launch. The 192px, 512px and maskable PNGs reuse the existing constituency crest; regenerate them with `node scripts/generate-app-icons.mjs`.

This release requires internet access. It adds no offline pages, background sync or content caching. The existing retirement worker still removes old `wassa-public-*` caches and unregisters itself. Installation is independent of analytics consent and does not create a public account.

When `beforeinstallprompt` is available, clicking the menu action invokes that browser prompt. A dismissed or failed prompt leaves browser-menu instructions available; only the browser's `appinstalled` event or standalone mode identifies installation. On iPhone/iPad the dialog explains **Safari → Share → Add to Home Screen**, keeping **Open as Web App** enabled if shown, and launching from the home-screen icon. Other browsers receive menu instructions when no prompt is available.

Implementation references: [Chrome installation criteria](https://web.dev/articles/install-criteria), [Chrome service-worker installation changes](https://developer.chrome.com/blog/update-install-criteria), and [WebKit home-screen web apps](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). HTTPS is required on the deployed origin; localhost testing does not establish production installation behavior.

## Verification

Automated Chromium tests validate the served manifest, icon dimensions, Apple metadata, prompt acceptance/dismissal and installation-event UI, keyboard focus, accessibility, and iPhone instructions using a phone viewport/user agent. These tests simulate install events; they do not install an Android WebAPK or an iPhone home-screen app.

Physical-device verification is pending: this Windows environment exposes no connected Android/iPhone device or device-testing service. On the deployed HTTPS origin, record the device, OS/browser version, URL, date and result for each check:

| Device | Install | Launch | Navigation and comments | Internet requirement |
| --- | --- | --- | --- | --- |
| Android / Chrome | Tap Install App; accept native prompt, or use browser Install app | Launch Wassa East icon; confirm name, crest and standalone home page | Open a project and article, submit a comment, use navigation/back | Disable network; confirm no saved project/news content is served |
| iPhone / Safari | Tap Install App; follow Share → Add to Home Screen; keep Open as Web App on | Launch Wassa East icon; confirm name, crest and standalone home page | Repeat project/article comment and navigation checks | Disable network; confirm network-dependent behavior |

Apply migration `0010_tearful_lake` through the normal deployment migration job before serving the updated application. No production database or deployment was changed by local implementation or isolated test runs.
