# Phase 4 implementation and verification

Implemented locally on 29 October 2026. Production release, operator training, full accessibility/browser acceptance, and infrastructure recovery remain Phase 5 work. Phase 1's real Google OAuth and Linux/Coolify acceptance are still outstanding. The user explicitly deferred Contact and chose to keep live push disabled until a sender identity is approved.

## Delivered behavior

- Guest comments collect no email and require no public account. An HttpOnly, SameSite=Strict random device cookie identifies the submitting browser; only its hash is stored. Pending submissions never appear publicly. Visitors can withdraw their messages, report approved comments, and send private feedback or corrections.
- Approved comments and official public replies appear only on currently published projects. Feedback/correction responses remain private to the originating device. Officers prepare immutable replies; an independent approver or operator reviews them. Known staff authors cannot review their own guest submissions. Decisions require reasons and optimistic version checks.
- Arithmetic challenges are device-bound, single-use, expire after ten minutes, and require a two-second review interval. Honeypots, repetitive text/link checks, origin checks, database rate limits, and short-lived HMAC abuse fingerprints supplement moderation. Bodies and display names are excluded from audit metadata and inbox previews.
- Approvers can close new comments without closing private feedback, and set an audited reminder interval from 0–365 days. Zero disables reminders. Ongoing/delayed projects default to a reminder after 30 days without an approved update. A unique revision/recipient/interval key prevents duplicate notices; reminders never change project status.
- `/following` stores follows and revision read status locally. Preferences do not sync across devices. Its feed projects only current approved project fields. Clearing browser data removes local preferences and access to the device's private submission statuses.
- Staff inboxes are MFA-protected and recipient-scoped. Moderation and report screens are protected by the same application MFA gate as the existing editor.
- Internal reports filter categories, communities, status, workflow, modification/completion dates, overdue updates, and text. They include application/moderation counts, recent changes, and CSV/XLSX/PDF exports. No visitor analytics or political-affiliation inference was added. Reports apply filters in SQL before enforcing the 5,000-row export bound.
- Internal exports may include budgets, expenditure, and funding sources. CSV neutralises formula prefixes; Excel stores titles as literal strings and uses typed amounts/dates. PDF uses a bundled Unicode Noto Sans font with its OFL licence, wrapping and pagination.
- Public report generation uses separate SQL that never reads financials. It creates an ordinary private report draft and an evidence PDF; the existing independent approval workflow controls publication. Source revision dependencies reject stale drafts at approval, and a withdrawn source blocks already published derived report pages and evidence. Previously downloaded/offline copies cannot be remotely recalled.
- Retention runs daily: approved comments remain until withdrawal; other visitor submissions expire after 12 months, abuse logs after 30 days, challenges and expired rate-limit rows are pruned, and inactive devices/subscriptions and terminal delivery jobs expire. Necessary body-free audit metadata remains.

## Browser push decision and implementation

`ENABLE_BROWSER_PUSH=false` is the default and current operating choice. `.local/vapid.env` contains locally generated keys, ignored by version control; no approved sender identity is set and no live push was sent during verification. An empty/invalid identity keeps the configuration endpoint disabled even if the flag is accidentally enabled.

The optional delivery path uses standard VAPID and browser-vendor endpoints. Permission is requested only on an explicit enable click. Subscriptions are encrypted using the environment's MFA encryption key, device-owned, and restricted to recognised HTTPS push hosts. Existing subscriptions synchronise followed IDs without prompting. Delivery jobs have unique subscription/revision keys, retry with backoff, cancel stale/withdrawn records, remove 404/410 endpoints, and create generic staff notices after exhaustion. Notification previews and clicks use fixed generic text and `/following`; they carry no administrative content.

## Offline boundaries

Serwist is bundled separately with esbuild so Next's Turbopack build is preserved. `predev`, `prebuild`, and the isolated test/build scripts generate `public/sw.js` and civic icons. The web manifest supports installation; browser menu instructions remain available when an install prompt is unavailable.

Offline reading is opt-in. Caches retain up to ten public HTML pages for seven days, thirty public thumbnails for 24 hours, and ten public feed URLs for seven days. Entries have byte caps and saved timestamps. Public pages use cookie-free HTML requests and an explicit response eligibility marker; RSC responses are excluded. Public thumbnails use a dedicated approved-only endpoint that never grants an authenticated staff bypass. Full media/PDF downloads are online-only. Private engagement, staff pages, authentication, administrative APIs, uploads, and unpublished files have no service-worker cache route. There is no offline write queue or background submission sync.

Online reads check the server first. Missing/withdrawn responses remove saved copies, and reconnection revalidates cached resources. A disconnected copy can remain visible until the browser reconnects, expires, or clears it; the banner explicitly states its save time and possible staleness. Hashed public build assets have a separate 120-entry/30-day cache. Disabling offline reading removes saved public data copies.

## Verification evidence

Verification uses the isolated `wassa_test` database and a built standalone server, never a deployed environment. Test accounts and register records are removed afterward. Temporary exported fixtures are under ignored `.local/phase4-verification/`.

- Unit tests cover CSV formula safety, Excel reopening/types, Unicode PDF pagination, push endpoint restrictions, submission validation, and the earlier security/content/filter/metadata rules.
- Browser/integration tests exercise pending/public/private visibility, guest withdrawal, official reply independence, staff self-review denial, stale decisions, closed comments, origin/challenge/spam/rate controls, recipient-scoped inboxes, disabled push configuration, exports and report approval/withdrawal, reminders/retention, and fake push retries/expiry/cancellation.
- Browser tests cover follows and read status, opt-in offline HTML with dated warning, withdrawal purge, and absence of staff/private routes in CacheStorage while browsing as MFA-verified staff. The public-thumbnail endpoint rejects an internal upload even for that staff session.
- The exported internal and public PDFs were rendered with Poppler and visually inspected. Extracted public PDF text excludes private finance markers. Excel reopens with numeric progress/currency and date cells; generated fixture names remain literal text.

Final results: 17 unit tests and 30 standalone browser/integration tests pass; TypeScript and lint pass. The production build succeeds with database/auth/map/push credentials deliberately blank. Production runtime smoke checks confirm public discovery, following, manifest/icons/service worker, protected staff APIs, disabled push and absence of preview fixtures/Contact. The updated development worker starts successfully. Agent-browser visual inspection of the local Following page confirms its controls and disabled-push notice, with no page errors.

Real vendor push delivery, mobile OS installation/background behavior, live map tiles, real Google OAuth, and Linux/Coolify volume permissions require their configured environments and remain explicitly unverified.
