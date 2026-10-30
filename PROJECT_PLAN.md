# Wassa East Project Tracking Platform

Agreed phased implementation plan, saved on 29 October 2026.

## Project status and resuming work

- Status: Phase 5 pre-deployment checks are implemented locally, with Chrome and phone use prioritised. Security, accessibility, mobile workflows and local load checks pass. Backups and documentation are explicitly deferred. Domain/Google configuration and Linux/Coolify deployment remain pending; live push stays disabled.
- Current phase: Phase 5 - local verification and deployment preparation; production acceptance, launch content, training and launch remain unfinished.
- Source brief: `WASSA EAST CONSTITUENCY.pdf` in this folder.
- This plan records the user's decisions and overrides conflicting requirements in the source brief, particularly public accounts, financial disclosure, notifications, and handover.
- Build through five reviewable milestones, followed by **one complete public launch**.
- Preliminary effort estimate: **40-60 working days**, subject to design review and representative project data. This is an engineering estimate, not a price or committed delivery date.
- To resume: read this document, inspect the current project files and any repository instructions, and continue the first unfinished phase. Update the checklist and continuation notes after meaningful work.

### Progress checklist

- [ ] Phase 1 - Design and Technical Foundation
- [x] Phase 2 - Project Management and Approval (locally implemented and verified)
- [x] Phase 3 - Public Website and Project Discovery (locally implemented; live map tiles pending a key)
- [x] Phase 4 - Engagement, Reporting, and PWA (locally implemented; live push disabled by user decision)
- [ ] Phase 5 - Verification, Training, and Launch

## Phase 1 - Design and Technical Foundation

**Estimated effort: 5-7 days**

- Establish the civic visual identity: restrained NDC colours, accessible typography, mobile navigation, and reusable interface components.
- Design the homepage, project directory, project profile, submission form, and approval dashboard.
- Set up Next.js, TypeScript, Tailwind CSS/shadcn/ui, PostgreSQL, Drizzle, and the background worker.
- Configure Docker and Coolify deployment, isolated local-development and production environments (no staging environment), secrets, and persistent storage.
- Implement invitation-only staff authentication with password and Google sign-in, mandatory authenticator-app MFA, and role permissions.
- Enforce MFA on both login paths. Google sign-in must not bypass the application's second-factor check.
- Add operator-generated, expiring, single-use setup and recovery links. The operator shares these personally; the application sends no email.

**Exit criteria:** Approved screen designs, a working local application, production-ready deployment configuration, and verified permissions and MFA on both login paths. The operator has explicitly chosen no staging environment.

### Phase 1 implementation status

- [x] Public design system and responsive homepage, directory, project detail, updates, and About screens.
- [x] Separate approval-dashboard and project-submission design previews with clearly labelled sample records.
- [x] Next.js/TypeScript/Tailwind/shadcn foundation, locally hosted fonts, PostgreSQL schema and Drizzle migration.
- [x] Isolated local development database and separate browser-test database; no default operator account.
- [x] Invitation-only staff authentication, shared application MFA gate for password and social sessions, replay protection, recovery codes, and role checks.
- [x] Operator-generated one-use setup/recovery links, hashed token storage, password-reset session revocation, and audit logging.
- [x] PostgreSQL-backed background worker started and verified locally.
- [x] Non-root Docker image definitions, resource-limited Coolify Compose configuration, persistent private media volume, and deployment documentation.
- [x] Six security tests and 11 production-mode browser/integration tests passing; lint and TypeScript checks passing.
- [x] Clean production build without build-time secrets; runtime production isolation confirms no sample records or design routes.
- [x] Packaged standalone runtime checked, with zero automated accessibility violations on the homepage, admin overview preview, and staff sign-in. Detailed evidence and limitations are in `docs/PHASE_1_VERIFICATION.md`.
- [ ] User review and approval of the design direction; approved branding and project photography still to be supplied.
- [ ] Real Google OAuth callback/account-linking verification after environment credentials are configured. A synthetic social session has verified the provider-independent MFA gate; this is not a live Google login test.
- [ ] Docker image/runtime validation on the target Linux host and eventual Coolify production deployment. Docker is not installed in the local environment; no remote infrastructure has been changed.

Local preview: `http://localhost:3000`; admin design review: `http://localhost:3000/preview/console`; real staff sign-in: `http://localhost:3000/staff/login`.

See `README.md`, `docs/DESIGN_SYSTEM.md`, and `docs/DEPLOYMENT.md` for resuming, design decisions, and environment setup. Phase 1 remains unchecked until its outstanding acceptance items are resolved.

## Phase 2 - Project Management and Approval

**Estimated effort: 10-15 days**

- Build manual project entry, categories, subcategories, communities, tags, milestones, attribution, and project dates.
- Start with Education, Health, General, Community Development, and Social Amenities. Super administrators manage taxonomies and system settings.
- Support planned, ongoing, completed, delayed, suspended, and cancelled statuses.
- Record progress percentages from 0-100%, with explanations and evidence. Track milestones separately rather than calculating weighted progress.
- Implement draft, submission, return, rejection, approval, publication, and withdrawal workflows.
- Preserve revision history and the last approved public version while changes await review.
- Prevent self-approval for every role, including super administrators. Apply independent approval to projects, material updates, announcements, and public reports.
- Require an actual completion date, completion summary, 100% progress, and at least one photo or supporting document before completion approval.
- Store budgets, expenditure, and funding details internally. Exclude these from public pages, APIs, exports, notifications, and cached content.
- Implement protected image/PDF uploads, image optimisation, metadata removal, and access-controlled downloads.
- Add approval queues, decision reasons, audit logs, and immediate audited withdrawal by approvers.
- Publish approved revisions atomically and reject conflicting or outdated approval actions.

**Exit criteria:** Two separate staff members can take a project from draft to publication, revise it safely, and withdraw it. Unpublished records and attachments remain inaccessible publicly.

### Phase 2 implementation status

- [x] PostgreSQL records and revision snapshots for projects, announcements, and public PDF reports.
- [x] Manual entry with all six statuses, progress explanation, milestones, dates, attribution, tags, approved video links, and internal financial information.
- [x] Operator-managed categories, subcategories, and communities; five agreed initial categories seeded. Real communities must be entered by the operator.
- [x] Draft, submit, return, reject, approve, publish, revise, discard private draft, and immediate audited withdrawal actions.
- [x] Self-approval blocked for authors, editors, upload contributors, and submitters, including operators. Submitted snapshots cannot be edited.
- [x] Record locks, optimistic draft versions, single active revision, stale publication checks, and atomic publishing.
- [x] Protected image/PDF uploads, optimised images with metadata removed, private financial files, public evidence visibility only after independent approval, and attachment withdrawal across history.
- [x] Real staff register, review queue, revision comparison/history, decision reasons, and operator audit trail.
- [x] Public directory, detail, updates, and report pages connected to approved snapshots to verify publication. Expanded discovery and maps remain Phase 3.
- [x] Local operator created on the user's instruction: **Platform operator**, `operator@wassa-east.local`. Password and authenticator enrolment are completed by the user through the privately supplied one-use link. No setup token is stored in this plan.
- [x] Separate staff accounts exercised draft-to-publication and revision/withdrawal flows against an isolated database. See `docs/PHASE_2_VERIFICATION.md` for checks and limitations.
- [ ] User review with representative constituency data; real branding and photography remain to be supplied.

## Phase 3 - Public Website and Project Discovery

**Estimated effort: 8-12 days**

- Build the homepage around recent work, photographs, featured projects, category shortcuts, and database-derived statistics.
- Build paginated project browsing with keyword, category, subcategory, community, status, and update-date filters.
- Create stable, shareable project pages with progress, milestones, approved history, galleries, documents, and verified attribution.
- Include project objectives, location, dates, source information, responsible organisation where verified, and the authorised reporting office.
- Add announcements, About, and public report pages. Contact is deferred at the user's explicit request on 29 October 2026; do not add it until requested again.
- Implement a lazy-loaded MapLibre map using Geoapify tiles, required attribution, clustering, and project filters.
- Keep projects without reliable coordinates available in the directory. Do not invent exact project locations.
- Add search-engine metadata, social previews, accessible states, and responsive layouts.

**Exit criteria:** Visitors can find projects through search, filters, and maps, then inspect their approved evidence and history without signing in.

### Phase 3 implementation status

- [x] Homepage uses recent approved project cards, available approved photographs, category shortcuts, and full database-derived counts. Category totals are no longer limited to 100 project cards.
- [x] Paginated keyword/category/subcategory/community/status/approved-update-date filters with sorting, persistent filter URLs, empty/invalid states, and list/map views.
- [x] MapLibre loads only on request, clusters approved locations, provides keyboard project selection and reduced-motion navigation, and uses attributed Geoapify raster tiles when configured.
- [x] Missing key, network failure, unsupported map rendering, missing coordinates, and sample-data cases retain the project directory. No project coordinates are estimated. Map responses contain explicit public summary fields and at most 1,000 markers, with a truncation notice.
- [x] Shareable detail pages include progress, objectives, milestones, dates, verified attribution, published coordinates where available, photo enlargement, PDFs, approved history, tags, and sharing/copy-link controls.
- [x] Dedicated announcements/reports indexes, updates navigation, and About information. Contact is intentionally omitted on the user's instruction.
- [x] Canonical URLs, approved-record metadata, generated social preview images, structured data, dynamic sitemap, and environment-aware robots rules. Withdrawal removes records from these online surfaces.
- [x] Responsive controls and galleries; keyboard map selection and dialog dismissal; public retry/empty/error states. A full accessibility/browser acceptance audit remains Phase 5.
- [x] Five new discovery browser scenarios plus the existing 18 regressions; security/filter/metadata unit tests; production compilation and fixture-isolation verification. See `docs/PHASE_3_VERIFICATION.md`.
- [ ] Configure an origin-restricted `GEOAPIFY_API_KEY` and verify live Geoapify tile delivery and attribution. The user explicitly chose the fallback until a key is available. No paid service was activated.
- [ ] User review with approved branding, photography, and representative project data; earlier Google OAuth and Linux/Coolify acceptance items remain open.

## Phase 4 - Engagement, Reporting, and PWA

**Estimated effort: 10-14 days**

- Enable account-free guest comments with optional display names, moderation, reporting, spam controls, and rate limits. Do not collect public email addresses or require email verification.
- Add private feedback and correction forms, official responses, and controls to disable comments.
- Store public project follows and read preferences on the device. Explain that preferences do not synchronise between devices.
- Build public update feeds and staff notification inboxes.
- Add opt-in browser push for notifications when the app is closed. Include permission, unsubscribe, retry, and expired-subscription handling.
- Use standard browser push with VAPID, without a separate notification vendor. Browser vendors' push delivery infrastructure is still involved.
- Keep sensitive administrative details out of device notification previews.
- Flag ongoing and delayed projects after 30 days without an approved update, with per-project interval exceptions. Reminders do not automatically change project status.
- Build administrative reports covering categories, statuses, locations, completion periods, overdue updates, pending reviews, recent modifications, and public feedback.
- Support CSV, Excel, and PDF administrative exports. Generate separately approved public reports using an explicit allowlist that excludes internal fields.
- Report application metrics without introducing a separate visitor analytics service or inferring political affiliation.
- Add PWA installation and bounded caching of recently viewed public pages and thumbnails, with saved-time and potentially outdated-data notices.
- Require connectivity for comments, administrative changes, and uploads. Do not cache administrative pages, unpublished content, or private files.
- Implement retention: approved comments until withdrawal, other public submissions for 12 months, and abuse logs for 30 days. Remove expired data through scheduled jobs and retain only necessary audit metadata after content deletion.

**Exit criteria:** Moderated engagement, device follows, notifications, reports, and offline reading work together. Administrative and unpublished content never enter public caches.

### Phase 4 implementation status

- [x] Device-bound guest comments, private feedback/corrections, own-message withdrawal, comment reporting, premoderation, spam/challenge/rate controls, and no visitor email collection.
- [x] Independent review of official responses, optimistic moderation decisions, audited comment/reminder settings, and protected staff moderation/inbox screens.
- [x] Device-only follows and revision read status, approved update feed, optional browser push integration, subscription ownership/encryption, retries, expiry and withdrawal cancellation.
- [x] Thirty-day overdue reminders for ongoing/delayed projects, per-project exceptions, deduplicated inbox notices, and scheduled retention without automatic project-status changes.
- [x] Internal reporting, filters, application metrics and CSV/XLSX/PDF exports; typed Excel values, safe CSV cells, Unicode PDFs and separately reviewed public report drafts excluding financials.
- [x] Generated public report source tracking; stale sources reject approval and withdrawals block derived report pages/evidence.
- [x] Install manifest/icons and Serwist service worker; explicit offline opt-in, bounded public pages/thumbnails/feed caches, dated stale notices and online-only writes. Verified staff/private routes and internal media do not enter CacheStorage.
- [x] Seventeen unit tests and 30 standalone browser/integration scenarios pass. Exported PDFs were rendered and inspected; public PDF text excludes private financial markers. Evidence and operating details: `docs/PHASE_4_VERIFICATION.md`.
- [x] User decision: no approved VAPID sender identity yet; keep live push disabled. Local keys are generated in ignored storage. No live notifications were sent.
- [ ] Live browser/OS push delivery and installation acceptance after an approved HTTPS deployment and sender identity are available; this does not enable delivery automatically.

## Phase 5 - Verification, Training, and Launch

**Estimated effort: 7-12 days**

- Test publication permissions, self-approval prevention, revision conflicts, financial-field isolation, secure downloads, and account recovery.
- Verify comments remain private until moderated and withdrawn content disappears from online public surfaces.
- Test Chrome on desktop and phone layouts, prioritising touch workflows. The user narrowed the current scope to Chrome only. Physical phone installation and HTTPS/background behavior still require the deployed environment.
- Check keyboard access, contrast, forms, and navigation against WCAG 2.2 AA.
- Load-test 1,000 projects and 100 concurrently active visitors on the shared server using browsing, filters, project details, and map queries. Target under 1% server errors and public read-response p95 below one second.
- Configure encrypted daily database and media backups to Hetzner Storage Box: 14 daily, eight weekly, and three monthly copies.
- Complete an isolated restore drill against the 24-hour recovery-point and one-working-day restoration targets. Verify records, attachments, permissions, and login after restoration.
- Configure health checks, failed-job monitoring, disk alerts, and log rotation. Failure alerts must not depend solely on the component that failed; document how the operator checks platform health without application email or messaging.
- Complete client acceptance testing, an illustrated administration guide, one recorded training session, and the operator runbook.
- Load approved launch content, verify production configuration, and release publicly.
- Schedule quarterly restore drills and ongoing dependency, security, storage, and backup reviews.

**Exit criteria:** Acceptance checks pass, recovery is demonstrated, client staff can operate their workflows, and production monitoring is active.

### Phase 5 pre-deployment status

- [x] Chrome acceptance on 360px and 430px touch-enabled phone emulation and 1440px desktop; public and real staff pages scanned against WCAG A/AA automated rules, with keyboard focus and workflow checks. This is not a claim of physical-device testing or complete manual WCAG certification.
- [x] Fixed phone sign-out access, readable form text/touch targets, accessible names, keyboard-accessible table scrolling and skip-link focus. Staff creation/submission, independent approval, guest forms, follows, and offline reading/clearing are verified.
- [x] Security review and dependency fixes; npm audit reports zero known vulnerabilities, and the migration tool's consistency check passes. Authentication JSON bodies are bounded. Public report approval now locks sources to prevent concurrent withdrawal from bypassing its freshness check.
- [x] Public HTML rendering is cached anonymously with a fresh database publication fingerprint on every request. Cache limits: 64 entries, 16 MiB total, 1.5 MB per response, five-minute maximum lifetime. Staff/private/API/RSC traffic is excluded; cookie-bearing or unmarked responses are rejected. Withdrawal invalidation and financial isolation pass regression checks. In-flight offline saves cannot restore copies after offline reading is disabled.
- [x] Local load test: 1,000 published plus 100 private projects, 100 simulated active visitors, 4,104 requests over about 31 seconds, zero errors/private marker leaks, p95 149 ms. The identical aggressive warm-cache workload initially measured p95 5,686 ms; the public-render optimization removed the bottleneck. This Windows 8-logical-CPU/16-GB result does not certify shared-host capacity or physical-phone network performance. Machine results: ignored `.local/acceptance/load-result.json`.
- [x] Deployment configuration prepared: special-character-safe database credential fields, matching non-root web/worker media ownership, privilege restrictions, bounded container logs, and database-aware readiness separate from liveness. Compose structure is validated; Linux/Docker/Coolify execution remains pending because no Docker runtime or target resource is configured.
- [x] Coolify-specific release preparation: `compose.coolify.yaml` pulls prebuilt web/tools images, fixes production/sample/push flags, persists database/media, and gates web/worker startup on successful migrations. A production environment template, secret-safe `deploy:check`, separate-builder Bake targets, and a manually triggered GitHub Linux image workflow are saved locally. The workflow defaults to build-only; optional publishing targets GHCR with commit tags and reports digests. No workflow, image publishing or remote deployment has run.
- [x] 22 unit tests and 48 Chrome acceptance/integration scenarios pass, including prior security/publication/discovery regressions. TypeScript, lint and credential-free production compilation pass. Production-mode startup with component database credentials, public/private isolation and readiness/liveness separation are verified; unavailable database returns readiness 503 and liveness 200 without connection details.
- [ ] Configure an approved hostname and real Google OAuth credentials; neither is available yet. A stopped Coolify production service is prepared, with no app containers launched or production operator created.
- [x] Push the application to `https://github.com/ram2ey/weprojecttracker` (`main`) and connect this working folder to the remote. GitHub Actions lint, type generation, TypeScript and unit checks pass on Linux; both Linux AMD64 images build and pass non-root media-write checks. The build-only run and image-publishing run both succeed. Application secrets, local databases/uploads, generated builds and the original requirements PDF are excluded from Git.
- [x] Prepare Coolify project `Wassa East Project Tracker`, its production environment and stopped service `wassa-east-project-tracker` on the existing Hetzner CX43. Target architecture is confirmed x86_64, with 8 CPU cores and 15.2 GB total RAM. Read-only terminal checks measured 12,954 MiB available RAM and 126 GB available disk. Dedicated PostgreSQL storage and shared web/worker media storage are configured under the service UUID; no containers were started.
- [x] User confirms the three production secrets have been entered and saved in Coolify, followed by a return to Normal View. Values remain masked by browser controls and were not displayed or independently checked for exact contents; runtime validation remains pending.
- [x] Configure Coolify's GHCR pull access. The user completed registry login, Coolify reports `ghcr.io` logged in, and both published images were successfully pulled by their exact digests on the Hetzner server. No app containers were started.
- [x] User chose a free Cloudflare Quick Tunnel HTTPS address for a funding demo before purchasing a domain. `compose.coolify-demo.yaml` preserves production settings and adds only `127.0.0.1:33187:3000`; the port is confirmed unused. The official Cloudflare connector image is pinned by digest and its non-root, read-only runtime check passes on the target without opening a tunnel. `compose.demo-tunnel.yaml` is saved as a stopped Coolify resource named `wassa-demo-https` in the same production environment. Its generated Compose correctly preserves host networking without an incompatible Docker network attachment. No connector process or public demo endpoint is running yet.
- [ ] Obtain the final browser-required confirmation to create public demo access, then start the temporary connector, set the generated HTTPS address as `APP_URL`, and deploy the app. Create the first operator after its details are selected. Separate production secrets and published image digests are held in ignored `.env.production.local`. Real volume writes, HTTPS and application/worker runtime acceptance on the target remain pending. Coolify reports an overdue subscription and pending proxy changes; shared proxy and billing settings were not modified. A new Quick Tunnel process receives a new hostname, requiring an APP_URL update; it is a temporary demo route, not the final production domain.
- [ ] Validate Linux images, volume permissions, HTTPS, host resource headroom, real phone behavior and representative target-host load. Configure host/worker/disk monitoring and complete client content/design acceptance before launch.
- [ ] Deferred by user: backup/restore implementation and drills, administration guide, runbook and training documentation. These requirements are postponed, not waived. No new guide or backup tooling was created during this pre-deployment pass.

## Fixed technical and operating decisions

| Area                | Agreed approach                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform            | English-language public website and installable PWA                                                                                                      |
| Stack               | Next.js, TypeScript, Tailwind CSS/shadcn/ui, PostgreSQL, Drizzle, Better Auth                                                                            |
| Background jobs     | Separate worker using pg-boss; no Redis dependency planned                                                                                               |
| Hosting             | Existing shared Hetzner server, operated through Coolify                                                                                                 |
| Capacity baseline   | 1,000 projects, 10,000 monthly visits, 100 concurrently active visitors, 20 GB uploaded media                                                            |
| Available resources | User reports at least 4 GB spare RAM; plan around 50 GB free disk and verify actual CPU/disk headroom before deployment                                  |
| Media storage       | Persistent server volume outside public web directories; no S3 media-storage service at launch                                                           |
| Uploads             | JPEG, PNG, WebP images up to 10 MB; PDFs up to 20 MB; validate signatures and sizes, re-encode images, remove location metadata, and generate thumbnails |
| Video               | Approved external video links; no direct video uploads                                                                                                   |
| Maps                | MapLibre with Geoapify's attributed free tier initially; monitor quotas and review any paid upgrade before activation                                    |
| PWA caching         | Serwist; public recently viewed content only, with bounded storage and stale-data notices                                                                |
| Notifications       | In-app feeds/inboxes plus optional browser push; no email, SMS, or WhatsApp                                                                              |
| Public identity     | No public accounts; optional display name for guest comments; no public email collection                                                                 |
| Staff access        | Invitation-only password and Google sign-in, mandatory application MFA, operator-managed recovery                                                        |
| Client roles        | Constituency-wide project officers and approvers; a different person approves publication                                                                |
| Operator role       | Retains super-admin control, staff invitations, role assignments, taxonomies, system settings, and infrastructure operation                              |
| Backups             | PostgreSQL dumps and media backups using encrypted Restic over SFTP to Hetzner Storage Box                                                               |
| Environments        | Separate local-development and production data, credentials, and media paths; no staging environment                                                     |
| Deployment          | Docker through Coolify behind HTTPS reverse proxy; build images outside the production server                                                            |
| Data location       | No known client restriction; document actual hosting and processing locations before production                                                          |
| Handover            | No source-code or infrastructure handover deliverable; client receives application administration and training                                           |

### Public and private interface boundaries

- Use separate public and administrative response types and explicit public field allowlists.
- Public read interfaces expose only approved project summaries/details, map locations, announcements, reports, comments, and feeds.
- Guest submissions and anonymous device push-subscription interfaces require validation, rate limits, and secure preference-management mechanisms.
- Administrative interfaces enforce role permissions and MFA on the server, including direct API requests.
- Attachment requests check publication or staff authorisation. Unpublished files must never become reachable through unrestricted static storage paths.
- Preserve audit records for administrative actions, publication decisions, withdrawals, role changes, and recovery operations.
- Apply resource limits, bounded background-job concurrency, database indexes, pagination, and log rotation on the shared server.

## Explicit exclusions

- Public user accounts and cross-device preference synchronisation.
- Public budgets, expenditure, and funding details.
- Application email, SMS, WhatsApp, and separate notification-service subscriptions.
- Satisfaction surveys and managed questionnaires.
- Native Android/iOS applications and app-store publication.
- Direct video uploads.
- Malware-scanning infrastructure at launch; selected upload controls are optimisation and validation.
- Automatic offline administrative editing or upload synchronisation.
- Separate visitor analytics service.
- Source-code and infrastructure handover as a delivery requirement.

## Inputs and launch prerequisites

- Approved platform name, logo, brand assets, imagery, official contacts, and communication details, supplied by the client. Use clearly marked placeholders until approval.
- Domain and DNS access, production hostname, and Google OAuth configuration.
- At least two authorised client staff identities to support independent submission and approval.
- Representative initial project records, photographs, documents, attribution, communities, and reliable coordinates where available.
- Confirmed shared-server specifications, actual spare CPU/RAM/disk, existing workload, and successful capacity tests.
- Hetzner Storage Box credentials and an appropriately protected backup encryption secret.
- Client-approved privacy notice, moderation policy, and confirmation of applicable data-protection responsibilities before production.
- No fixed launch date or monetary budget has been set. Monetary pricing remains separate from the engineering effort estimate.
- Recurring costs comprise the existing server allocation, domain, Storage Box, and maintenance. Media growth and map usage determine later capacity changes; no paid upgrade is activated without review.

## Technical references checked during planning

- [Coolify: Next.js deployment](https://coolify.io/docs/applications/framework-examples/javascript/nextjs)
- [Next.js: Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Better Auth: Two-factor authentication](https://better-auth.com/docs/plugins/2fa)
- [pg-boss: PostgreSQL-backed background jobs](https://github.com/timgit/pg-boss)
- [Serwist: Next.js integration](https://serwist.pages.dev/docs/next/getting-started)
- [Geoapify: Map tile documentation and attribution](https://apidocs.geoapify.com/docs/maps/map-tiles/)
- [Hetzner Storage Box: SSH, SFTP, and Restic support](https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/)

Verify current versions, compatibility, service terms, and quotas when implementation begins.

## Continuation notes

- 30 October 2026: User approved and requested implementation of interface simplification and Creato Display throughout public and staff screens. Removed the shared green authentication panel, centered login/setup/MFA forms, self-hosted the original Regular/Medium/Bold font files with their SIL OFL licence, and removed the former font dependencies. Trimmed promotional/repeated copy, header ribbon and footer slogans while preserving security/privacy/approval guidance and authored records. Local checks: lint, TypeScript, 23 unit tests, Chrome phone/desktop accessibility and workflow checks; affected checks rerun successfully after updating changed labels. Added real font-loading assertions. Preparing the updated image release and redeployment of the existing app, preserving the running Cloudflare connector and current demo URL. No API or database changes; backups and further guide documentation remain deferred.
- 29 October 2026: Source PDF reviewed and requirements discussed. Phased plan approved for saving.
- 29 October 2026: Phase 1 application foundation, public/admin design previews, PostgreSQL migrations, staff authentication, universal application MFA, one-use setup/recovery links, worker, Docker/Coolify configuration, tests, and operating documentation implemented locally.
- 29 October 2026: Operator explicitly chose no separate staging environment. Local development and review precede a single production deployment.
- Validation: six security tests and 11 browser/integration tests pass. Clean production compilation, TypeScript, lint, worker startup, and production preview isolation were verified. Accessibility checks prompted contrast and landmark fixes.
- 29 October 2026: Phase 2 persisted projects, announcements, reports, independent review, revision history, protected evidence, financial isolation, audit trails, and withdrawals implemented locally. Approved snapshots are connected to the public pages.
- Local development operator created at the user's request as **Platform operator** (`operator@wassa-east.local`). Its one-use setup link was supplied privately in chat. Temporary test accounts and records are isolated from development and removed after tests.
- Phase 2 validation: nine security/validation tests and 18 browser/integration scenarios, plus lint, TypeScript, credential-free production compilation, and production fixture isolation. Detailed evidence: `docs/PHASE_2_VERIFICATION.md`.
- No remote server, OAuth application, or paid service has been provisioned or modified. Google OAuth and Linux/Coolify runtime validation remain outstanding from Phase 1.
- 29 October 2026: Phase 3 expanded public discovery, full category counts, lazy MapLibre clustering, galleries/sharing, announcements/reports indexes, approved-only metadata/social images/sitemap, and responsive states implemented locally.
- 29 October 2026 user decisions: Leave Contact out for now. No Geoapify key is available; build the map with a clear fallback. No external map account or paid plan has been provisioned.
- 29 October 2026: Phase 4 moderated guest engagement, independently reviewed official replies, device follows/read state, staff inboxes/reminders, reporting/exports, public report drafts and bounded PWA offline reading implemented locally. Migrations `0002_lazy_prowler.sql` and `0003_friendly_menace.sql` are applied locally. Updated worker starts successfully.
- 29 October 2026 user decision: Keep live browser push disabled until an approved sender identity exists. Keys are generated locally in ignored `.local/vapid.env`; production credentials must be separate. Fake transports cover retries, exhaustion, expired endpoints and withdrawal cancellation without contacting a push provider.
- Phase 4 validation: 17 unit tests and 30 standalone browser/integration scenarios pass, including the earlier phase regressions. PDF render/text checks and Excel reopen/type checks pass. Final production packaging/runtime checks are recorded in `docs/PHASE_4_VERIFICATION.md`.
- Final Phase 4 checks: TypeScript and lint pass; credential-free production build and production-isolation smoke checks pass. Updated local worker and development server are running. Following/installation/offline controls are visually checked, the disabled-push notice is present, and browser page errors are clear.
- Next implementation action: Select the production hostname, configure Google OAuth and the Coolify resource, then validate Linux runtime/volumes, HTTPS, physical phone behavior and target-host load/monitoring. Backups and documentation remain deferred at the user's request. Preserve publication/financial/cache isolation, Contact omission, disabled live push, map fallback and the no-staging decision.
- 29–30 October 2026: User authorised pre-deployment work, narrowed browser checks to Chrome with phone use prioritised, and deferred backups and documentation. No hostname or Google OAuth configuration is ready. Local verification, mobile fixes, dependency/security fixes, anonymous public-render optimization and deployment preparation are complete; 22 unit and 48 Chrome/integration checks pass. Local 100-visitor performance measured p95 149 ms with zero errors. Continue with environment setup and target-host acceptance when available; retain the deferred work and do not enable live push automatically.
- 30 October 2026: Coolify preparation continued for the supplied GitHub repository. Development database verified to contain zero content records and one local operator; isolated test database contains zero content records and zero accounts. Sample project data exists only in design-preview code, disabled in production; migrations seed five categories only. Current unit run: 23 tests passing, including three deployment configuration cases. Production configuration CLI success/rejection and secret non-disclosure, TypeScript, lint and Compose structural checks pass. Docker/Linux, workflow execution, registry access, HTTPS and production acceptance remain unverified. Backups and guide documentation remain deferred.
- 30 October 2026: User authorised doing the GitHub work directly. The empty repository received the complete application, with verified action versions pinned to commit SHAs. Linux build verification succeeded: https://github.com/ram2ey/weprojecttracker/actions/runs/41018805347. Release image publishing succeeded: https://github.com/ram2ey/weprojecttracker/actions/runs/41019127188. Published release source is commit `5f8175794d611f56a2d25c3e5bd81412ed822086`; images are `ghcr.io/ram2ey/weprojecttracker-web@sha256:b4bf8cac2c81492a5a39e1ca741dd682a6b4fc58ce8369f12ffae43c86c0a30b` and `ghcr.io/ram2ey/weprojecttracker-tools@sha256:3d2e19e3ab50ea1338025700f8abd43a49736a6535e985fb2272cc454e7c76f9`. Current working folder now tracks `origin/main`. No Coolify resource or production database has been created or changed; backups and further documentation remain deferred.
- 30 October 2026: After the user signed into Coolify, prepared the project and stopped Compose service at https://app.coolify.io/project/jcygp6beltufto31a2tl2mvy/environment/wor2x5imsytwjb4yumjt01rf/service/pnj4g33ejfgwgpgqkqbeol3v. Saved published image digests and safe defaults. Removed explanatory text from required Compose expressions (`${VARIABLE:?}`), because Coolify imported that text as placeholder environment values. Required hostname and credentials are deliberately empty in Coolify, and deployment is blocked by its missing-variable warning. The user must enter credentials and configure registry access before launch; no production data, operator or running container was created. Backups and further guide documentation remain deferred.
- 30 October 2026: User completed secret entry and GHCR login; exact web/tools image pulls succeed on the target server. The immediate objective is a funding demonstration without buying a domain yet. User selected a free Cloudflare HTTPS demo link, acknowledging temporary addresses and traffic passing through Cloudflare. Prepared connector resource: https://app.coolify.io/project/jcygp6beltufto31a2tl2mvy/environment/wor2x5imsytwjb4yumjt01rf/service/68aasphiehclt9r4512ccume. Connector image: `cloudflare/cloudflared@sha256:004d843fa5fdc3103983fd580ee19fab4a8fa98add31f87249c1659e848c98e0` (official 2026.10.6). Both resources remain stopped pending the final public-access confirmation. HTTPS remains mandatory; staff MFA, disabled live push, map fallback, Contact omission and deferred backups/documentation are preserved.
- 30 October 2026: User approved public demo deployment and the temporary **Demo Operator** account (`demo.operator@wassa-east.local`). Connector and application deployed successfully. Current temporary origin: https://improved-brussels-limitation-husband.trycloudflare.com. APP_URL saved in Coolify and the ignored local production environment file; configuration validation passes. Target verification: migration exited 0, PostgreSQL and web containers healthy, worker reports ready, media volume writable as non-root UID 1001, web port bound only to 127.0.0.1:33187, external HTTPS readiness returns 200. Public push reports disabled, map configuration absent with working UI fallback, and unauthenticated staff content API returns 403. Deployed database contains zero content records, zero media files and one staff account. Live homepage, phone-width layout/navigation, project directory and staff login checked in Chromium. Private one-hour operator setup link saved only in ignored `.local/demo-operator-setup.txt` and opened for user password/MFA completion. No sample projects seeded. Pending: user account setup/MFA, authenticated target workflows and physical-phone acceptance, permanent domain/Google OAuth, production load acceptance; backups and further guide documentation remain deferred. Restarting the quick-tunnel process changes its address and requires updating APP_URL.
