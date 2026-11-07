# Web delivery plan — Wassa East project register

Agreed **7 November 2026**. This is the active delivery plan: finish and deliver the web app, obtain client acceptance and receive payment before starting Android work. The [Google Play roadmap](GOOGLE_PLAY_SUBMISSION_PLAN.md) is retained for later use.

Payment will fund the Play developer account, ongoing backups and paid email. These purchases are deferred. Zoho Mail Free remains the current email arrangement; send/receive verification is still pending. This plan does not authorize purchases, deployment, a main-branch merge or external messages by itself.

## Current position

The reduced web app is implemented and locally verified. CI, deployment safeguards and permanent-domain HTTPS are prepared. The reduced candidate is in a draft PR; the latest photo-hero changes remain local and unpushed. The live domain still serves the older application. A completed implementation is not yet a completed client delivery.

The numbered phases below are web-delivery phases, separate from the numbering in the Google Play roadmap.

## Phase 1 — Finish the app

Status: **technical verification passed and user approved the design on 7 November 2026; behavior acceptance pending**. Candidate, evidence and the review checklist are recorded in [the Phase 1 review](WEB_PHASE_1_REVIEW.md).

Release decision — **7 November 2026**: after receiving the technical verification results and approving the design, the user explicitly requested committing the changes and merging to main so Coolify can redeploy, for client presentation. The tested local candidate is accepted for release. Final live verification and client/commercial acceptance remain separate; this decision does not claim personal manual testing of every workflow.

- [ ] Review the final public register, hero, project pages, About page and empty/error states with the user.
- [ ] Review phone layouts, visible search, combined filters, pagination, keyboard access and readable text.
- [ ] Confirm staff editing, submission, independent approval, return, revision and withdrawal; review password changes, resets, account access and conflict/unsaved-work recovery.
- [ ] Resolve remaining web defects and agree any explicitly deferred items.
- [x] Run the checks appropriate to the final changes: lint, types, retained unit/browser tests and production build/startup verification. Reuse valid evidence where code has not changed. Implementation verified the current local candidate: lint/types, 22 unit tests, 69 browser checks, production build/startup/error recovery and whitespace checks passed on 7 November 2026.
- [ ] Record the reviewed candidate and user acceptance of the local design and behavior.

**Completion point:** the local candidate passes the agreed checks and the user's review. Existing evidence includes lint/types and 69 browser acceptance checks after the hero change; this does not replace final client review.

## Phase 2 — Prepare for handover

Status: **in progress**. On 7 November 2026 the user selected an empty public register at launch, with staff adding projects afterward, confirmed public publisher wording as **Wassa East Constituency**, and confirmed permission to use the logo and images (including the reviewed hero). The existing support address remains `support@wassaeastprojecttracker.com`; delivery verification is pending. Commercial terms and client sign-off belong to handover and are not technical deployment prerequisites.

The user will manage staff accounts and password recovery. Individual editors and the independent approver will be assigned later; this is compatible with an empty launch, but publication must wait for those separate roles. The user confirmed the support mailbox has **not yet been tested**; do not describe it as verified or send test messages without explicit authorization.

Funding clarification — **7 November 2026**: the client needs the working deployed web app before payment; that payment will fund email, backups and Android developer fees. The user states none of those services is working now. Treat email and backup services as unavailable at launch, not as pre-deployment purchases or prerequisites. Do not present the support mailbox as working. Staff password recovery uses the operator/maintenance route rather than email. A one-time copy using existing storage is a separate proposed release precaution, with its location and limitations to be explained before authorization; no copy has been authorized or made by this discussion.

- [ ] Agree the client delivery scope and acceptance checklist. Record sign-off authority and existing payment terms during commercial handover; these do not block technical preparation or deployment. Do not assume a new fee or payment deadline.
- [ ] Confirm publisher/branding wording, source attribution, photograph permissions and the support contact; verify the free support mailbox can send and receive.
- [ ] Prepare proportionate website privacy information based on actual data handling, without waiting for Android declarations.
- [x] Agree launch-content scope: launch with an empty public register; Project Personnel add real projects afterward and a separate Project Lead approves publication. No initial project set is required. Keep synthetic test data out of production. Inspect existing production publications before release; this decision does not authorize deleting or withdrawing existing records.
- [ ] Prepare concise staff instructions for drafts, approval, corrections, withdrawal, passwords and reporting problems. Confirm office-controlled access and recovery ownership without putting credentials in documents or chat.
- [x] Record deferred services and their practical limits: ongoing backups, working/paid email and Android remain deferred until deployment and payment. A one-time private server plus downloaded safety copy now exists; no full restore has been demonstrated. See [the safety-copy record](WEB_RELEASE_SAFETY_COPY_2026-11-07.md). Retain the existing operational runbook.

**Completion point:** launch scope and operational materials are ready for the controlled release. Commercial sign-off and payment remain Phase 4 responsibilities and are not technical release gates.

## Phase 3 — Deploy and verify

Status: **release authorized on 7 November 2026; preparation and live verification in progress**. Main merges trigger the release pipeline. Preserve the one-time safety copy and existing production data/configuration.

- [x] Arrange a one-time database/media safety copy before the production migration and record its location and recovery steps securely. User authorized server plus downloaded copies; both were created and their integrity verified on 7 November 2026. [Locations, checksums and recovery limits](WEB_RELEASE_SAFETY_COPY_2026-11-07.md) are recorded. A full restore remains untested; reassess copy freshness before release. Ongoing paid backup service remains deferred.
- [ ] Review the final diff, green CI checks, paired images, additive migrations and saved Coolify Compose definition. Preserve existing data, files, secrets and volume names.
- [ ] Coordinate account conversion and temporary-password delivery with staff; confirm a trusted operator-recovery route.
- [ ] Release the approved reduced candidate through the deployment pipeline, removing the retired worker with the matching configuration.
- [ ] Verify the running release and migration, HTTPS/origins, redirects, public browsing, photographs, retired routes and service-worker retirement.
- [ ] Verify staff sign-in and editor → submission → independent approval → public revision → withdrawal using controlled records. Check historical-media privacy and session revocation.
- [ ] Activate the prepared GitHub health monitor and verify notifications with the office IT administrator as incident owner.
- [ ] Record live acceptance results and fix release-blocking issues.

**Completion point:** the reduced app is live on https://wassaeastprojecttracker.com, agreed acceptance checks pass and remaining operational limits are documented. Existing domain setup alone does not close this phase.

## Phase 4 — Handover and payment

Status: **pending**.

- [ ] Demonstrate the live app and train the small staff group on their roles.
- [ ] Hand over documentation, authorized access, support responsibilities and the agreed deferred-service list through appropriate secure channels.
- [ ] Obtain client sign-off against the agreed delivery checklist and record any remaining support obligations.
- [ ] Prepare the invoice under the existing client agreement; the user sends it and confirms receipt of payment.
- [ ] Record web delivery acceptance and payment separately; neither should be marked complete on assumption.

**Completion point:** web delivery is signed off and payment is confirmed received.

## After payment

Resume Android planning as a separate workstream. Review and fund the developer account, backup service and any paid email upgrade with the user before activation. Recheck current Play requirements when Android work resumes. Preserve all earlier work and evidence; do not treat unfinished Play tasks as web-delivery blockers.

## Scope and tracking

Retain the agreed minimal register: up to 200 projects, roughly 2–5 staff, public browsing without accounts, five categories, six statuses, private history and independent approval. No spreadsheet import, new engagement features or major redesign is added by this plan.

For each open item, record its owner, evidence and any accepted limitation when work is performed. Implementation prepares code, tests and reviewable materials; the user coordinates office content, client approval, commercial terms and payment. Purchases, live releases and messages to third parties require their applicable authorization.
