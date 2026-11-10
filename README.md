# Wassa East project register

A minimal public register for up to 200 constituency projects and roughly 2–5 staff. Visitors search and filter projects without signing in. Editors prepare drafts; a separate approver publishes or returns them. The public site shows only the latest approved record and its photographs.

## Local setup

Use Node.js 22.12 or newer and the isolated local PostgreSQL cluster:

~~~text
npm ci
npm run db:local
npm run db:migrate
npm run staff:bootstrap -- operator "Platform operator"
npm run dev
~~~

The bootstrap command creates the first operator only, displays a temporary password and its 24-hour deadline once, and requires a password change at first sign-in. Expired temporary credentials need an operator reset (or the maintenance command for an operator). Open http://localhost:3000 for the register and /staff/login for staff access. No default password is installed.

For an existing database, migration 0004 preserves accounts, password hashes, project history and unused legacy data, assigns usernames, revokes old sessions and requires a password change. Migration 0005 adds temporary-password expiry and gives accounts still awaiting a password change a 24-hour transition window from migration time. Existing permanent passwords remain unaffected. Run npm run staff:accounts to list assigned usernames. For an operator with no password, an expired temporary password or a lost password, run npm run staff:accounts -- USERNAME from the trusted maintenance environment to generate a one-time-display temporary password. The operator manages other staff through the Staff screen.

Migration 0006 adds a staff access-version counter to reject sign-ins already in progress when a password/access change occurs. Reset, password change and access revocation invalidate pending sign-ins as well as existing sessions. Apply all migrations before starting the matching code; no credential hashes or historical content are removed.

## Launch scope

The homepage links to the register at /projects, individual /projects/[slug] pages, /about, /contact, /faq and /privacy. Public search matches project title or community. Filters cover category, community and status. Project codes are internal staff references, excluded from public pages, share previews, public API responses and public search matching.

The sticky public header includes Home, Projects, Favourites, About and Contact Us. Staff bookmark /staff/login directly. Contact offers the approved phone and WhatsApp number. The email form is shown in preview until a provider and mailbox are configured. See [contact and privacy decisions](docs/PUBLIC_CONTACT_UPDATE.md).

Optional first-party page-view statistics require acceptance in the consent banner or Cookie settings. Operators view aggregate daily counts/popular pages at /admin?view=analytics. No visitor IDs, IPs, search text or third-party analytics are stored in statistics. Counts cover up to 90 days, with expired rows removed on collection/dashboard access; the preference cookie remembers choices for 180 days. See [consent and analytics behavior](docs/CONSENTED_ANALYTICS.md). Apply additive migration 0007 before starting this version.

Projects contain title, description, category, community, status, information source and photographs/captions. Completed projects additionally require a valid completion date, summary and photograph. The five categories are fixed; operators manage communities. All six project statuses remain available.

Staff have username/password sign-in, private revision history, independent approvals, conflict checks, unsaved-edit warnings and access revocation. The latest approved version remains public while an edit awaits review. Withdrawals immediately block new public requests. Historical and withdrawn images remain available privately to staff.

Save draft keeps unfinished work private; required publication fields are explained in the editor and checked before submission and on the server. Unsaved-edit warnings cover normal navigation, revision changes and reload, with copyable conflict recovery. Browser/OS termination can bypass these warnings: unsaved work is not stored durably or in browser storage. Save private drafts frequently.

Creato Display is self-hosted with system fallbacks. Public source text links only valid HTTP(S) URLs; other text is escaped. Full photographs use same-tab navigation so browser/Android Back returns to the project. Android device acceptance is still required after packaging.

HTML uses a fresh CSP nonce per request and dynamic rendering. Scripts, fonts, images, connections and forms are restricted to the app; frames/objects are blocked. Style attributes are allowed for Next Image/Radix compatibility. Development alone permits script evaluation and WebSocket connections. HTTPS/proxy/cookie behavior must be rechecked on the final host.

Simple visitor comments appear immediately beneath each published project. Visitors supply an unverified name and plain-text message; only operators can hide/restore comments or close/reopen submissions at /admin?view=comments. Opening the form creates a signed essential anti-abuse cookie for up to 24 hours. Comments work independently of optional statistics consent. Apply additive migration 0008 before starting this version. See [project comments](docs/PROJECT_COMMENTS.md).

The retired guest-discussion system, following, notifications, maps, offline reading, announcements, reports/exports, Google login, MFA and dark mode remain inactive. Their database tables and historical data are retained. New comments use a separate table. No background worker is required. The temporary /sw.js retirement worker clears only this app's old offline caches and unregisters itself.

## Homepage publishing and public integrations

Apply migration 0009 and open **News & Features** in the staff workspace. Officers and operators can save drafts, upload a photo, select a published project, and submit for review. A separate approver or operator publishes the revision. Revising a story preserves the live copy until approval. Approvers can return submissions and withdraw published stories. The homepage shows the three latest approvals, with Read more links to individual story pages. Published stories remain available at their links after newer items appear on the homepage. Withdrawal also removes the public story page. Sample content is limited to design preview.

Set `GOOGLE_PLAY_URL` and `APP_STORE_URL` independently when each listing is available. For contact email, see [mailbox configuration](docs/PUBLIC_CONTACT_UPDATE.md). Existing Coolify Compose Empty installations need the updated Compose environment mapping before activating the integrations.

## Verification

~~~text
npm run typecheck
npm run lint
npm test
npm run test:acceptance
npm run test:migrations
node scripts/build-production.mjs
node scripts/check-production.mjs
~~~

Acceptance tests build a standalone production server at port 3100 against the isolated wassa_test database. They cover 200-project browsing, phone/desktop accessibility, publishing, account restrictions, migration preservation and removed features. They never use the development operator.

Build directories are separate: development `.next`, acceptance `.next-test`, and production verification `.next-build`. Set `TEST_DIST_DIR=.next-<name>` for acceptance, or `NEXT_DIST_DIR=.next-<name>` for both production build and smoke commands. Use the same value for the matching build/check pair and a distinct directory for any running preview. Never rebuild a preview's active output. The existing preview on port 3002 uses `.next-ci` and is left intact.

See docs/DEPLOYMENT.md for environment and release steps, docs/MINIMAL_RELEASE.md for the implementation record, and docs/DESIGN_SYSTEM.md for visual conventions. Earlier phase documents and the dated audit describe the pre-reduction app and are historical references.

Push-to-Coolify releases are configured in [docs/AUTOMATIC_DEPLOYMENT.md](docs/AUTOMATIC_DEPLOYMENT.md).

The active roadmap is the [web delivery plan](docs/WEB_DELIVERY_PLAN.md): finish the website, obtain client acceptance and receive payment before Android work. The [Google Play roadmap](docs/GOOGLE_PLAY_SUBMISSION_PLAN.md) is deferred until after payment. Publisher decisions are in [docs/PHASE_0_DECISIONS.md](docs/PHASE_0_DECISIONS.md), and earlier web-readiness changes/evidence are in [docs/PHASE_1_WEB_READINESS.md](docs/PHASE_1_WEB_READINESS.md).

Phase 2 adds disposable PostgreSQL/Chromium acceptance in GitHub Actions, a synthetic legacy migration rehearsal, Linux migration-failure/startup checks, exact-release deployment verification and basic external uptime checks. Operational steps and remaining live gates are in [the Phase 2 runbook](docs/PHASE_2_RELEASE_RUNBOOK.md). Backups and restore testing remain explicitly deferred.
