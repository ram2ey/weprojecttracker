# Development and Coolify deployment

## Local development

Requirements: Node.js 22.12+, npm, and PostgreSQL 16. On Windows, the local helper detects `C:/Program Files/PostgreSQL/16/bin`; set `POSTGRES_BIN` for another installation.

1. Run `npm ci`.
2. Run `npm run db:local`. This creates an isolated PostgreSQL cluster in `.local/postgres`, bound to `127.0.0.1:55432`, and creates `.env.local` with random secrets if it does not exist. It never changes the installed PostgreSQL service.
3. Run `npm run db:migrate`.
4. Run `npm run staff:bootstrap -- operator@example.com "Operator name"` with your actual operator identity. The first-operator command refuses to create another operator once one exists.
5. Open the one-use setup link privately, set a password, sign in, enrol an authenticator, and store recovery codes securely.
6. Run `npm run dev` and, in a separate terminal, `npm run worker`.
7. To stop the isolated database, run `npm run db:local -- stop`.

Do not commit `.env.local`, `.local`, generated setup links, recovery codes, or database dumps. Setup secrets are carried in the URL fragment so they do not enter web access logs. Public signup and native email reset endpoints are unavailable.

`npm run test:e2e` creates and migrates a separate `wassa_test` database on the isolated local cluster, builds the application, and runs its standalone production server on port 3100. It uses development preview content for foundation screen checks, then real database-backed staff and publishing workflows. Test uploads use the absolute `.local/test-media` directory. The suite removes its test accounts and records afterward; it never changes the development operator. Browser tests default to installed Chrome on Windows; set `CHROME_PATH` or install Playwright's browser on other systems.

This development database already has the user-requested local account `operator@wassa-east.local`. Its setup link and authenticator secrets must never be saved in project documentation. Use a real operator identity when bootstrapping production.

## Publishing and media

Run all migrations before starting the updated application. Migration `0001` adds projects, immutable submitted revisions, taxonomy, and protected media metadata, and seeds the five agreed categories. Add real communities in **Categories & places** before submitting projects; no locations are invented.

Officers and operators prepare drafts. Approvers and operators review revisions they did not author, edit, upload evidence for, or submit. A returned or rejected submission is preserved; create a new draft to correct it. Completed projects require 100%, an actual date, a completion summary, and evidence. Publishing uses a record lock and optimistic version checks; outdated edits and decisions return a conflict instead of overwriting other work.

Images support JPEG, PNG, and WebP, up to 10 MB and 40 megapixels. Stored images are metadata-free WebP, bounded to 2000px, with separate 640px thumbnails. PDFs support static, unencrypted documents up to 20 MB/500 pages. Active scripts and embedded-file structures are rejected. These checks are not an antivirus service; a scanner was excluded from scope. Reviewers must inspect public documents and prose for internal financial information before approval. Mark financial uploads internal at upload time; they can never be made public by changing a caption or visibility selector.

Keep `MEDIA_ROOT` outside the public folder and serve it only through the authenticated/approved-evidence route. Do not add CDN caching or image optimisation caching to `/api/media/*`; these responses deliberately use `private, no-store` so withdrawal takes effect on subsequent requests. Previously downloaded copies cannot be recalled. Staff can inspect preserved withdrawn files for audit purposes.

The standalone build explicitly includes Sharp's installed native runtime libraries. Build on the same operating system/architecture as the deployment image; do not copy Windows `node_modules` to Linux. Verify a real image upload and PDF download from the Linux container before launch.

## Public discovery and maps

Phase 3 adds `/announcements`, `/reports`, `/sitemap.xml`, `/robots.txt`, approved-content social previews at `/api/og`, and filtered project map summaries at `/api/public/projects/map`. Contact is deferred on the user's instruction.

Set `GEOAPIFY_API_KEY` in the local environment or Coolify when available, then restart the web service. Use a Geoapify browser-map key restricted to the approved localhost/production origins in the provider dashboard. This key is intentionally delivered to browsers on demand; do not use a privileged backend credential. It is not required at build time. No public request reaches Geoapify until a visitor chooses to load a configured map.

The map uses Geoapify OSM Carto raster tiles and a visible Geoapify/OpenStreetMap attribution control. Retain those credits. MapLibre and its matching worker are bundled locally, without a CDN runtime dependency. Test actual tile delivery, attribution, CSP, quota monitoring, map clustering, and keyboard selection on the deployed hostname before launch. No paid tier is activated by the application.

The map API applies the directory's public filters, selects only approved non-withdrawn records, and returns at most 1,000 located project summaries. Visitors are told to narrow their filters if truncated. Unlocated projects remain in the paginated directory. No live locations are fabricated; sample fixtures have no markers.

Public detail metadata, structured data, sitemap entries, and social images use approved snapshots only. Social images are generated as PNGs, and withdrawn records return 404 on new image requests. Third-party social networks may retain previews they already fetched. Public detail pages deliberately avoid a parent streaming loading boundary so withdrawn/missing pages can retain HTTP 404 responses. Local/test environments disallow indexing; production robots rules permit public pages and social preview images while excluding staff/private API surfaces.

Use `BETTER_AUTH_URL` as the runtime public origin so canonical URLs and sitemap links match the deployed HTTPS hostname. Sitemap entries are generated per request and capped at 49,000 published records; add a sitemap index before approaching that limit. The current capacity baseline is 1,000 projects.

## Authentication and permissions

Better Auth handles password hashes, sessions, and Google OAuth. A separate application MFA proof is tied to the exact authenticated session, and is required by every protected page and administrative endpoint. It applies identically to password and social login; simply knowing the account password or completing Google OAuth grants no project access.

TOTP seeds use AES-256-GCM encryption with a separate environment key. Verification uses standard TOTP via OTPAuth, database-backed attempt limits, row locking, and replay prevention. Recovery codes are hashed and single-use. Password recovery does not disable MFA. Sessions expire after eight hours; deactivated staff lose access even if a session cookie still exists.

Keep account recovery codes in the operator's password manager. If all authenticators and recovery codes are lost, verify the person's identity outside the application, revoke their sessions, and perform a controlled, audited MFA reset through a reviewed operator maintenance procedure. There is no unauthenticated MFA-reset endpoint.

## Google configuration

Create a Google OAuth web application for each environment. Configure an authorised redirect URI of `https://YOUR_HOST/api/auth/callback/google`, plus a localhost callback for local testing if needed. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Coolify; do not place them in the repository. Only pre-authorised staff may sign in. Confirm callback/account-linking behaviour against a real Google test account before production acceptance. The application MFA check remains mandatory afterward.

## Coolify

The operator has chosen no separate staging environment. Review and integration testing happen locally, followed by one Coolify production resource when ready. Local development and production must have separate databases, media, secrets, and OAuth configuration. The Compose project name includes `DEPLOY_ENV` and defaults to production.

- Configure `DEPLOY_ENV`, `APP_URL`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, and optional Google credentials.
- Use HTTPS application URLs. Generate a random authentication secret of at least 32 characters and a separate 32-byte hexadecimal MFA key for each environment.
- Keep `ENABLE_DESIGN_PREVIEW=false` for deployment. Production startup must fail if preview is explicitly enabled.
- Build both Docker targets in CI or on a separate builder. Supply immutable `WEB_IMAGE` and `TOOLS_IMAGE` tags. Use the Compose build definitions only for controlled local verification; do not compile on the shared production server.
- Attach Coolify's HTTPS domain to the web service's internal port 3000. Do not expose PostgreSQL publicly. The worker has no public port.
- Before first traffic, run the migration tools profile, then bootstrap the operator inside the tools container. Do not put setup-link output in public deployment logs.
- Apply migrations as a controlled release step, not independently from every web replica. Stop the worker until first migrations have succeeded.
- Keep media on the persistent `/data/media` volume. It is not under `/app/public` and must never be exposed by an unrestricted static mount.
- Verify the runtime UID can write to the media volume. Both application image targets run without root privileges.

Resource ceilings are initial safeguards, not a capacity guarantee: PostgreSQL 1 GB, web 1.5 GB, worker 512 MB. Inventory available resources and verify under load before production acceptance. Reserve additional headroom for Coolify, the operating system, backups, and existing workloads.

## Health, backups, and recovery

`GET /api/health` is a liveness check and exposes no secrets. Verify database connectivity and the worker separately during release checks; liveness alone is not readiness. Coolify container status and the Hetzner console provide checks independent of the web UI. External email/SMS/messaging alerts are disabled by the agreed notification policy.

Daily encrypted backups to a separate Hetzner Storage Box and automated retention/restore drills are Phase 5 deliverables. Preserve PostgreSQL logical dumps, media, deployment configuration, and securely escrowed authentication/MFA keys. A database backup without the MFA key cannot recover enrolled authenticators.

Before a release: back up the database and media, test migrations on an isolated local database, verify image health and MFA gates, and retain the previous immutable images. Roll back code only when the deployed schema remains compatible; restore into an isolated environment before any destructive recovery.

## Phase 4 operation

Apply migrations through `0003_friendly_menace.sql` before starting the updated web/worker processes. Both are backward-compatible additions to the content register. The worker runs inbox reminder scans every five minutes, a push dispatch scan every minute, and retention at 02:17 UTC daily. An unavailable worker delays reminders/cleanup/delivery; normal content approval remains transactional and public submissions are still premoderated.

Keep `ENABLE_BROWSER_PUSH=false` until an approved sender identity and production keys are configured. The user has explicitly chosen this disabled state. `npm run push:keys` writes ignored `.local/vapid.env` without printing keys; generate separate production keys in the deployment environment. To enable later, configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as an approved `mailto:` address or public HTTPS URL, then explicitly enable the flag in both web and worker. No Firebase account or separate push vendor is required. Retain private keys across releases so existing subscriptions remain usable. The MFA encryption key also encrypts subscription credentials; include it in secured backups and plan migrations before rotating it.

Use `TRUST_PROXY_HEADERS=true` only behind a proxy that overwrites incoming `X-Real-IP`/`X-Forwarded-For` headers and prevents direct access to the app. Otherwise leave it false; a conservative site-wide fallback combines with per-device limits. Abuse fingerprints are HMACs with daily rotation, not raw IP logs. Review proxy normalization and limits against expected production traffic before launch.

Service worker generation is part of `npm run build`. Serve `/sw.js` at the application root with no-store/no-cache and same-origin service-worker scope. Offline reading requires HTTPS (localhost is allowed by browsers), explicit visitor opt-in, and sufficient browser storage. Cache limits are ten public pages/7 days, thirty public thumbnails/24 hours, and ten public feed URLs/7 days, plus bounded build assets. Never add private API/media or administrative routes to runtime caching. Browser or network outages may leave an already saved public copy visible until it reconnects or expires; do not promise remote deletion of downloaded copies.

Staff exports include private financial values and must be handled internally. Generate public reports with the dedicated draft action, review the attached PDF, then submit for independent approval. A source project update invalidates an unapproved generated report; regenerate it. A source withdrawal removes derived public report access and requires a fresh reviewed report before republication. Export queries cap matching records at 5,000; narrow filters for larger registers.

Guest submission retention is automatic: approved comments until withdrawal, all other public submissions for 12 months, abuse logs for 30 days. Visitor-device access depends on its cookie and expires after prolonged inactivity; no email recovery or cross-device lookup is available. Staff can withdraw an approved comment after an independently handled request. Audit records retain decision metadata, not submission text. Ensure backups follow the launch retention policy as well; deleting live records does not immediately remove historical encrypted backups.

## Pending environment acceptance

Docker and live Coolify validation require the operator's server and deployment configuration. Real Google OAuth verification requires configured OAuth credentials. Neither is represented as completed by local builds or simulated session tests.
