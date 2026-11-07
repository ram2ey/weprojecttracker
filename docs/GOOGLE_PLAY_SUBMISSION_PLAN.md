# Google Play submission plan — Wassa East project register

Prepared **6 November 2026**, from `PLAY_STORE_READINESS_AUDIT_2026-11-06.md`. The phases below define implementation work, responsibilities, dependencies and evidence required for submission readiness.

**Priority update — 7 November 2026:** Android work is deferred until the web app is delivered, accepted and paid for. Follow the [active web delivery plan](WEB_DELIVERY_PLAN.md) first. This roadmap and its evidence are retained for later; its phase numbers are separate from the web-delivery phases. Payment is intended to fund the developer account, backups and paid email.

**Recommended release shape:** the existing hosted Next.js register, delivered to Android through a Trusted Web Activity (TWA); public browsing requires no account; staff administration remains a web workflow. Confirm this in Phase 0. The current server-rendered application and database continue running on Coolify. [TWA overview](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities).

Retain the minimal scope: up to 200 projects, roughly 2–5 individual staff, five categories, six statuses, independent approval and private history. Preserve existing data, stored historical files, Git history and uncommitted design work. New public accounts, comments, maps, following, notifications, financial reports, dark mode and offline project caches are not release prerequisites. A major visual redesign and spreadsheet import are outside this plan.

No permanent staging environment is proposed. Continue local review and isolated test/restore environments, followed by controlled releases to the existing production resource. Public Android testing will use an explicitly selected stable hosted release; tests must not create or alter real public records accidentally.

## Order, dependencies and responsibilities

| Phase | Outcome | Depends on | Primary responsibility | Audit coverage |
| --- | --- | --- | --- | --- |
| 0 | Publisher, scope, domain and account decisions recorded | None | Publisher, supported by implementation | A01–A06 |
| 1 | Web app corrections and security hardening complete | 0 for scope; most work can start immediately | Implementation | A09–A14 |
| 2 | Recoverable infrastructure and verified delivery pipeline | 0; parallel with 1 | Implementation + infrastructure owner | A02, A07, A08, A16 |
| 3 | Privacy, publisher information and launch content ready | 0; parallel with 1–2 | Publisher/editors + implementation | A03–A06 |
| 4 | Reduced web app released and verified on final domain | 1–3 | Implementation + operator | A02, A07, A08 |
| 5 | Signed Android candidate with verified website association | 0 and stable domain/release from 4 | Implementation + Play account owner | A01, A05, A09, A10 |
| 6 | Android/device/accessibility/performance acceptance | 5 | Implementation + representative testers | A09, A10, A15 |
| 7 | Complete Play listing and declarations | Draft after 0; finish after 3, 5–6 | Publisher + implementation | A03–A06 |
| 8 | Required testing track and submission handoff | 6–7 | Play account owner + testers | A05 |

The publisher supplies truthful identity/affiliation, rights to branding and photographs, account verification, domain ownership, launch records, support ownership and testers. Implementation prepares code, configurations, test evidence, Android builds and reviewable store materials. Infrastructure and Play account access should use individual authorized accounts; credentials should be entered into the relevant service or secret store, not placed in chat or the repository.

## Phase 0 — Resolve identity and release decisions

Start account verification early; it can delay submission independently of development.

- [ ] Identify the legal/organizational publisher and the person responsible for the register.
- [ ] Determine the actual affiliation: government agency, MP office, political party or independent publisher. Verify authorization for the constituency identity/crest. Do not assume that an MP/party project automatically qualifies as an official government app.
- [ ] Agree the app name, developer display name, support contact, launch countries, primary language and intended audience. The presence of school projects does not by itself determine the target age group.
- [ ] Confirm the public-only Android scope and how the Staff sign-in link behaves: omit it from the Android public navigation or open administration in the external browser. Server authorization must remain unchanged.
- [ ] Select an owned HTTPS domain and who controls DNS/renewal. Reserve a durable Android package identifier after confirming ownership; do not use a temporary tunnel name as the app identity.
- [ ] Confirm TWA as the starting architecture. Record any genuine native requirements that would change that decision before building a wrapper.
- [ ] Inspect the Play Console account type, owner, verification status and production-access requirements. Use the correct organization-account route where applicable, including for authorized government apps. [Account types](https://support.google.com/googleplay/android-developer/answer/13634885).
- [ ] Assign operational and editorial owners, a content-review cadence and acceptable recovery objectives.

**Deliverables:** a short decision record; identity/domain/package details; ownership list; Play account checklist; approved minimal Android scope.

**Exit gate:** identity and scope are unambiguous, account verification is initiated or complete, and domain/account ownership can be demonstrated. Unresolved affiliation blocks publication wording, not independent local engineering work. For government information, plan clear sources and accurate affiliation in both app and listing. [Government-information policy](https://support.google.com/googleplay/android-developer/answer/9514050).

## Phase 1 — Finish the web application

**Complete locally after follow-up correction — 6 November 2026.** Implementation/evidence: [Phase 1 web readiness](PHASE_1_WEB_READINESS.md), [follow-up review](PHASE_1_FOLLOWUP_REVIEW_2026-11-06.md): 19 unit tests, 69 browser checks, lint/types/build/startup/error-state smoke checks pass; zero npm advisories. A concurrent sign-in/revocation race found during re-review is fixed with additive migration 0006 and regression coverage. Android hardware validation follows packaging in Phase 6; final-host HTTPS/proxy/security acceptance remains Phase 4. This does not close the outstanding Phase 0 account tasks or deploy this candidate.

### Interface and usability

- [x] Restore Creato Display through local-font loading/fallbacks; browser verification confirms it actually loads.
- [x] Bring navigation/buttons/filter controls/standalone links to 48px minimum target height, including empty-state Clear filters. Verify on real Android in Phase 6.
- [x] Reduce phone header/heading spacing while retaining logo, clear title and visible search.
- [x] Review long titles/community names/captions, no-photo/zero-result/invalid-filter states and unavailable/withdrawn/not-found pages.
- [x] Explain required submission fields and preserve unfinished private draft saving.
- [x] Make HTTP(S) source URLs tappable while keeping escaped text and safe URL schemes.
- [x] Verify keyboard focus, 200% text scaling, filter chips, pagination and Back navigation in the browser suite; preserve labels and skip navigation. Android display/font scaling remains Phase 6.
- [x] Define same-tab full-photo navigation with Back to return; validate the packaged Android behavior in Phase 6.

### Security and staff reliability

- [x] Add documented 24-hour temporary-credential expiry, additive migration and server enforcement; verify expiry/reset/deactivation/used-password restrictions and revocation.
- [x] Enforce nonce-based CSP using installed Next.js guidance; verify hydration/forms/images/authentication and injected-script blocking. Final-host checks remain Phase 4.
- [x] Resolve tooling advisories through a scoped reviewed minimatch override; retain Next.js 16.4.3. No forced downgrade.
- [x] Document unsaved-edit/crash-recovery limits and preserve guards/conflict-copy recovery. Android staff editing remains outside scope.
- [x] Separate configurable preview/test/production-verification build outputs; preserve the running preview.
- [x] Review the reduced-scope implementation and preserve existing uncommitted design work and legacy data.

**Deliverables:** reviewable code changes, updated tests/design notes and a web release candidate.

**Exit gate:** lint/types/unit tests and the retained browser suite pass; known audit regressions are covered; role enforcement, independent approval, conflict recovery and historical-media privacy still work. No critical/high unresolved security or data-loss issue remains. Any lower-priority deferral has a named owner and rationale.

## Phase 2 — Make production recoverable and deployment verifiable

Read-only live inventory completed 6 November 2026: [infrastructure audit](PHASE_2_INFRASTRUCTURE_AUDIT_2026-11-06.md). No Coolify backups, executions, scheduled tasks or S3 destinations are configured; user knows of no external backups. Backblaze B2 selected for the [proposed recovery plan](PHASE_2_BACKUP_AND_RECOVERY_PLAN.md). Setup/restore/release gates remain open; no live configuration or deployment changed during the audit.

**User decision — 6 November 2026:** defer backup setup and restore testing for now. Keep these items open; continue independent Linux/container verification and CI/deployment preparation without publishing or deploying. Recovery remains unproven and must be described accurately in a later release decision.

**Implementation update — 6 November 2026:** local checks now pass for the legacy migration rehearsal, exact-release readiness/migration gates and public smoke checks; 69 browser checks pass. CI acceptance, container rollout rehearsal and uptime workflow are prepared. GitHub Actions notifications are selected, with the office IT administrator as incident owner. See [the operational runbook](PHASE_2_RELEASE_RUNBOOK.md). Backup/restore remain deferred. Final-domain DNS/TLS were verified on 7 November for the existing app; reduced-app rollout and monitor activation remain open. Main now requires the five CI checks, a PR and resolved conversations, including for administrators. Current CI evidence and remaining gates are in [Phase 2 delivery status](PHASE_2_DELIVERY_STATUS.md).

### Infrastructure and recovery

- [x] Configure final-domain DNS, TLS and app-specific proxy routing on the existing service, retaining private PostgreSQL, volumes and non-root containers. [Verified 7 November](PHASE_2_DOMAIN_VERIFICATION_2026-11-07.md); reduced-app authentication/workflow acceptance remains Phase 4.
- [x] Prepare the matching reduced-app Compose definition. For the current Docker Compose Empty resource, a Git push does not replace its saved Compose definition automatically.
- [ ] Preserve the Cloudflare connector until the new public address is verified; retire or redirect the demo path deliberately rather than stopping it during setup.
- [x] Inventory existing server-side backup arrangements before adding anything.
- [ ] **Deferred by user:** implement database/media backups with an off-host destination, encryption, retention and restricted access.
- [ ] Agree recovery-point and recovery-time targets and a backup owner. Monitor unsuccessful backups.
- [ ] Restore a backup into an isolated environment. Verify published records, private revisions, image files, account access and migration state. Keep securely recorded legacy encryption keys where historical data requires them.
- [x] Rehearse 0004–0006 on a production-shaped synthetic legacy database: unique username backfill, unchanged password hashes/history/files, invalidated sessions, retry and operator recovery pass. A restored real-data rehearsal remains part of deferred backup/restore work.
- [x] Write a release/recovery runbook. Retain previous image references. Separate code rollback from database recovery; do not automatically reverse a migration or overwrite live data.

### GitHub/Coolify pipeline

- [x] Verify Linux web/tools image builds on GitHub runners without publishing/deploying: [run 42237662807](https://github.com/ram2ey/weprojecttracker/actions/runs/42237662807), 6 November 2026. CI checks and both image jobs passed; deploy skipped. Live runtime/migration acceptance remains open.
- [x] Add the browser acceptance suite to GitHub Actions using a disposable PostgreSQL instance and test-only credentials. Adapt the local-only harness assumptions explicitly for CI.
- [x] Run checks before publishing/deploying images. Keep paired web/tools release references and serialize releases.
- [x] Implement actual-rollout, migration-success and healthy-replacement gates; verified in synthetic Linux containers. Live Coolify rollout acceptance remains Phase 4.
- [x] Verify an expected release identifier before accepting `/api/ready`; old-container and missing-marker regression checks pass.
- [x] Add post-deploy checks for browsing, project detail/media when records exist, login entry, redirects and retired routes; live final-host acceptance remains open.
- [x] Configure appropriate required checks and repository protections; retain push-to-main automatic deployment after checks.
- [x] Record deployment-token rotation. The current token expires **6 December 2026**. Narrow access where supported and preserve controlled repository access.
- [x] Select independent GitHub Actions monitoring/notifications, with the office IT administrator as triage owner. Outage/recovery regression passes; diagnostics exclude credentials/private content.
- [ ] Activate the scheduled monitor after the final-host release and verify notification delivery/preferences; current `MONITOR_ENABLED=false`.

**Deliverables:** tested backup/restore record, migration rehearsal, production configuration, release/recovery runbook, CI acceptance and deployment-health evidence.

**Exit gate:** recovery is demonstrated, not merely configured; a failed check/build/migration/rollout produces a failed release; the app remains recoverable; domain/TLS and volume ownership are ready. An outage test proves the monitor detects failure if monitoring is introduced.

## Phase 3 — Prepare privacy, publisher information and real content

### Privacy and trust

- [ ] Build a data inventory covering the final Android experience, public browsing, staff accounts/sessions, IP/user-agent records, audit history, photographs, hosting/tunnel logs and any third-party SDKs.
- [ ] Decide purposes, processors, retention, access/deletion contacts and photograph-publication rules. Preserve existing data unless a separately authorized retention change calls for deletion.
- [ ] Draft an app-specific privacy policy naming the publisher/app and contact. Review it against actual code and infrastructure, including diagnostics and logs.
- [ ] Publish it as an accessible HTML page on the final domain and link it from the app; it must work without login or geographical restriction. [Privacy/review requirements](https://support.google.com/googleplay/android-developer/answer/9859455).
- [ ] Update About with the real publisher, affiliation, source-review process and correction/support contact. A maintained contact link is sufficient; restoring the old feedback backend is unnecessary.
- [ ] Prepare an evidence-backed Data safety worksheet. Do not infer “no collection” merely from anonymous browsing or lack of analytics. Finalize it against the built Android app. [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).
- [ ] Reassess account-deletion requirements only if account creation is introduced into the Android product. Public accounts are absent from the proposed scope; staff deactivation must not be described as deletion.

### Editorial launch readiness

- [ ] Agree a useful initial set of real projects. The supported capacity of 200 is not a mandatory number to populate.
- [ ] Enter launch records manually through editor accounts; verify categories, communities, statuses, source evidence and photo rights.
- [ ] Check completion dates/summaries/photographs and the accuracy of status claims.
- [ ] Have a separate approver review every initial publication. Avoid synthetic or placeholder projects in the public launch register.
- [ ] Review representative real records on phones, including long descriptions and records without photographs.
- [ ] Train the small staff group on submission, return, revision, withdrawal, conflict recovery, temporary passwords and reporting an error.

**Deliverables:** approved privacy/publisher/support pages, data inventory and declaration worksheet, content checklist, initial independently approved records and staff handover.

**Exit gate:** public information is useful and verifiable; publisher/branding statements are truthful; privacy/support URLs work; an editor and a distinct approver can operate the launch process. Final store screenshots wait until real content and Android UI are available.

## Phase 4 — Release the reduced web app on the final domain

The reduced app is currently local; the successful automation release did not deploy its feature reduction or migration. Treat this as a distinct application release.

- [ ] Review the complete source/configuration diff and save a pre-release database/media backup.
- [ ] Record the candidate commit, both image references, Compose definition, migration set and recovery procedure.
- [ ] Schedule the account conversion with staff: old sessions will be invalidated and passwords must be changed. Confirm a trusted operator-recovery route before rollout.
- [ ] Update the Coolify saved Compose definition in coordination with the matching images. Preserve volume names/mounts, final origin and existing secrets; remove the retired worker/runtime dependencies from this release.
- [ ] Deploy via the hardened pipeline. Confirm migration exit status, correct running release and healthy containers.
- [ ] Verify editor → submission → independent approval → public record → new revision → withdrawal using controlled records and the real hostname.
- [ ] Verify password change/reset/deactivation/session revocation, private historical media, completion rules and exclusion of legacy financial fields.
- [ ] Check canonical URLs, sitemap, social previews, public HTTPS and authentication origins. Confirm `/projects` query-preserving redirect and retired-route 404s.
- [ ] Keep `/sw.js` retirement behavior and test a previous installation's transition. Confirm no new offline project cache is registered.
- [ ] Verify monitor/recovery readiness, publish the initial approved content and record the successful release.

**Deliverables:** a stable production web release on the permanent origin, with content, policy pages and operational evidence.

**Exit gate:** the reduced app, migration and deployment configuration agree; the public release is healthy and recoverable; all supported public URLs work; source/media privacy and account conversion are verified on the real environment.

## Phase 5 — Build the Android candidate

- [ ] Create a version-controlled Android/TWA project using Bubblewrap or its supported tooling. Keep server code and database secrets on the server.
- [ ] Add the web app manifest, appropriate launcher/maskable/adaptive assets, launch appearance, display settings and public start URL. Verify branding at small icon sizes.
- [ ] Use the agreed package ID, version name/code and supported minimum Android version. Target SDK and minimum supported OS are separate decisions.
- [ ] Target **Android 16/API 36 or higher**, the current requirement for new standard phone/tablet submissions; recheck when preparing the upload. [Target SDK policy](https://developer.android.com/google/play/requirements/target-sdk).
- [ ] Set up Play App Signing and a protected upload key. Ignore keystores and secret properties before generating them; keep recovery information in an approved secure store.
- [ ] Publish Digital Asset Links using the correct package and **Play app-signing** fingerprint. Test the Play-installed build, not just a locally signed APK. [TWA association setup](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start/), [App signing](https://developer.android.com/studio/publish/app-signing).
- [ ] Limit trusted origins and generated Android permissions to actual needs. Review the merged manifest and bundled dependencies. The public register does not need location, contacts, broad storage or camera access.
- [ ] Implement predictable Back/deep-link/full-photo navigation, startup/network failure and Retry. Handle status/navigation-bar insets and soft-keyboard changes.
- [ ] Implement the agreed external-browser handling for staff administration/support/external sources. Keep server-side authorization authoritative.
- [ ] Build a reproducible signed AAB with no debug flags or secrets. Inspect compatibility requirements, including native-library/page-size requirements if any bundled SDK introduces native libraries.

**Deliverables:** Android source/build instructions, signed AAB, version record, permission/dependency inventory and verified domain association.

**Exit gate:** the candidate installs through Play's internal track, launches the correct verified site, requests no unnecessary permissions and exposes the intended public experience. Signing assets are protected and recoverable.

## Phase 6 — Validate the Android product

Test the candidate obtained from the Play internal track. Retest changes that affect the candidate, site, permissions, SDKs or privacy behavior.

| Area | Required scenarios | Acceptance evidence |
| --- | --- | --- |
| Public tasks | Browse, displayed-code search, combined filters, clear chips, pagination, all statuses, project/source/photo viewing | Task script and results using real content |
| Links/navigation | Cold and warm deep links, Back from detail/photos, external sources, withdrawn/invalid links, return from external browser | Device recordings or reproducible results |
| Lifecycle/network | Cold start, background/resume, process recreation, offline start, interrupted loads, recovery, portrait/landscape | No dead end or misleading stale-publication behavior |
| Accessibility | TalkBack labels/order, large text/display scaling, focus, contrast, 48dp-equivalent targets and keyboard visibility | Manual results plus automated checks |
| Device coverage | A lower-cost phone and a recent Android phone, smallest supported layout, current supported Android versions and relevant browser updates | Device/OS/browser matrix; optional Test Lab results |
| Performance | Populated/photo-heavy pages, realistic mobile network, image transfer, LCP/INP/CLS, controlled expected concurrency with 200 representative records | Recorded baseline and agreed performance budget |
| Privacy/security | Manifest/SDK review, final data inventory, private-media boundaries, no leaked credentials, domain association and transport | Reviewed artifact and boundary tests |
| Stability | Repeated task use, app switching, long text, loading failures and Android crash/ANR reports | No unresolved release-blocking failures |

- [ ] Keep the existing web suite as a regression layer; phone-sized desktop Chrome is not a substitute for Android testing.
- [ ] Fix problems and retest; use measurements to decide whether per-record media queries need batching. Do not restore the removed render cache or stale offline data as a shortcut.
- [ ] Review Play's available pre-launch reports, including warnings and their relevance to a browser-backed app. Supplement automated crawling with human task testing.
- [ ] Use only an authorized isolated copy for aggressive security/load tests; no unplanned load or active attack scan against the shared production server.

**Deliverables:** device/accessibility/performance report, resolved defect list, final candidate version and known-limitations record.

**Exit gate:** all primary tasks pass; no unresolved blocker in startup, navigation, content access, privacy or accessibility; the publisher accepts measured performance and supported devices.

## Phase 7 — Complete the Play submission materials

Draft early; finalize against the actual candidate and hosted release.

- [ ] Create accurate app name, short/full description, category/tags, developer/support details, privacy URL and intended distribution countries.
- [ ] Prepare store icon, feature graphic and screenshots to current Console specifications. Use real approved records and the actual Android candidate; avoid claims for removed or unimplemented features.
- [ ] Complete Data safety from the reviewed inventory; include applicable hosting/SDK behavior and ensure it matches the privacy policy.
- [ ] Complete content rating, audience, ads, government-app status and every applicable App content declaration shown by Console. Do not infer audience from branding or choose an age range merely to bypass requirements.
- [ ] Explain app access accurately. For public-only browsing, state that no account is needed. If any restricted workflow remains in scope, supply appropriate reviewer access and usable instructions.
- [ ] Check publisher/affiliation wording and source links in both listing and app. Supply authorization documentation where applicable.
- [ ] Upload the candidate AAB, address relevant Console compatibility/policy warnings and verify version/signature details.
- [ ] Archive the declaration worksheet, screenshots, release notes, candidate version and source commit together.

**Deliverables:** a complete, internally reviewed Play listing and declaration package tied to one tested candidate.

**Exit gate:** no applicable Console item is incomplete; review access works; the listing, privacy policy, declarations, Android artifact and live website describe the same product. [Google's review preparation guide](https://support.google.com/googleplay/android-developer/answer/9859455).

## Phase 8 — Complete the testing track and prepare submission

- [ ] Establish which production-access requirements apply to this specific developer account before choosing the submission date.
- [ ] Use the internal track first, then a closed test with representative local users. Supply a short task list and collect genuine problems and feedback, even where a mandatory tester minimum does not apply.
- [ ] For personal accounts created after 13 November 2023, meet the current requirement of at least **12 testers continuously opted in for 14 days**, then apply for production access and answer the testing/readiness questions. Finishing that period does not itself grant production approval. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
- [ ] Maintain a feedback/defect log. Resolve blockers and revalidate affected flows and declarations. Verify Console's track/continuity status when changing builds.
- [ ] Keep the tested live web behavior stable during the final Android test/review window. TWA website updates can change the installed experience even without a new AAB; material changes need appropriate retesting and declaration review.
- [ ] Recheck current target SDK/policy requirements, domain association, privacy/support URLs, token/signing validity, live health and recovery readiness.
- [ ] Assemble the final submission packet: AAB/version, source commit and web release, checks/results, reviewer instructions, listing/assets, declarations, test feedback and recovery/contact ownership.
- [ ] When all gates are satisfied, submit the production release through the authorized Play account. Agree initial distribution and post-approval release handling; do not promise an approval date.
- [ ] Triage any review request against the specific cited issue, update the app/materials as needed and resubmit the corrected candidate. Plan post-approval checks and incident ownership.

**Deliverable:** a tested, documented production submission candidate and completed applicable production-access process.

**Final readiness gate:** the authorized publisher confirms that the tested artifact and live site are the intended public release; no unresolved blocker remains; all applicable Play Console requirements are complete. Submission and Google approval are separate milestones.

## Tools and purchasing decisions

Use existing Playwright/axe, npm and GitHub Actions first. Add Bubblewrap/Android tooling for packaging, Android Studio/TalkBack for device validation and Lighthouse for performance. Consider Firebase Test Lab only for additional device coverage and ZAP baseline in an authorized test environment. Select an uptime/error-monitoring solution and backup destination with an operating owner. Optional hosted services may cost money; this plan does not activate any plan or subscription.

## Calendar and progress tracking

Engineering, infrastructure and content work in Phases 1–3 can overlap after Phase 0. Start publisher/Play verification, domain work and tester recruitment early. Android packaging follows a stable origin and web candidate; final screenshots/declarations follow device testing. Reserve the applicable closed-test period separately from development, plus variable account verification and Google review time. A fixed submission date should be chosen only after those dependencies are known.

Maintain one checklist per phase with an owner, status, evidence link and unresolved decisions. Map changes to audit IDs A01–A16. Close a phase only when its exit evidence is recorded, not when implementation is merely attempted.
