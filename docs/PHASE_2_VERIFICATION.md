# Phase 2 verification

Date: 29 October 2026.

This is the Phase 2 snapshot. Phase 3 has since added expanded discovery, maps, galleries/sharing, publication indexes, and metadata; see `PHASE_3_VERIFICATION.md`. The former 100-card category-count limitation is resolved. Contact is deferred at the user's request.

## Result

Project management and independent publication are implemented locally. Two separate staff accounts can create, submit, approve, revise, and withdraw real records. The same workflow covers announcements and public PDF reports. No remote deployment was performed.

## Implemented

- PostgreSQL content register, stable record codes/URLs, taxonomy, private financial fields, media metadata, revision snapshots, decision reasons, and audit events. Migration `0001` seeds Education, Health, General, Community Development, and Social Amenities.
- Real staff register, creation/editor forms, review queue, preserved revisions, comparison with the last publication, operator taxonomy controls, and audit trail.
- Planned, ongoing, completed, delayed, suspended, and cancelled statuses, independent milestone tracking, manually explained progress, project dates/location, tags, verified attribution, references, and approved video links.
- Draft/submission/return/rejection/approval/publication/withdrawal. Submitted snapshots are immutable; corrections create new revisions. The previous approved version remains public while changes await review.
- Authors, editors, upload contributors, and submitters cannot review their own revision, including operators. Publishing locks the record and checks revision/publication versions; conflicting edits and obsolete approvals fail safely.
- Completion requires 100%, an actual completion date, a summary, and an available evidence attachment. Financial attachments alone cannot satisfy the evidence requirement.
- Images validated by content/extension/type, decoded with pixel bounds, optimised to WebP with thumbnails, and stripped of metadata. Static PDF validation rejects encrypted, scripted, embedded-file, and unsupported documents. Financial uploads are permanently staff-only.
- Public allowlisted responses omit financial fields, internal attachments, internal decision information, contributor identities, and storage paths. Downloads require verified staff or approved public evidence. Immediate record/attachment withdrawal removes public access on subsequent requests; files remain inspectable by verified staff.
- Basic public directory, details, updates, reports, evidence, and approved history connected to actual publications. Local fixtures disappear once the content register has records and are always disabled in production.

## Verification

- `npm test`: nine security and content-validation tests pass.
- `npm run test:e2e`: 18 browser/integration scenarios pass against the packaged standalone server on port 3100, with a separate `wassa_test` database and `.local/test-media` upload directory.
- `npm run lint` and `npm run typecheck`: pass.
- `node scripts/build-production.mjs`: production compilation succeeds with database/authentication/MFA/Google credentials excluded from the build environment.
- `node scripts/check-production.mjs`: production runtime exposes no sample records, no admin design preview, and no sample project routes.
- Installed Chrome visually checked the development homepage without browser errors. Screenshots of the real editor and published page at 390px were inspected; forms fit without horizontal overflow. Evidence images were decoded as WebP without EXIF metadata.
- Standalone packaging was corrected to include Sharp's native companion libraries. Runtime media paths are excluded from build tracing.

Browser scenarios include role/origin checks, anonymous denials, operator taxonomy controls, the real editor through independent publication, protected evidence before approval, frozen submissions, operator self-approval denial, all-contributor denial, cross-record attachment denial, concurrent approval conflicts, stale saves, completion validation, preserved publication during revisions, return/reject/correction, publication withdrawal and reapproval, public/private financial separation, invalid uploads/active PDFs, attachment withdrawal, and announcement/report publication. The 11 existing authentication/foundation regressions also pass.

Screenshots are local, ignored artifacts: `.local/phase2-editor-mobile.png` and `.local/phase2-published-mobile.png`. Test users and records are removed afterward; test media may remain in the isolated ignored test directory. No test record is presented as a real constituency claim.

## Local operator and review

At the user's request, the development account **Platform operator** was created with the sign-in address `operator@wassa-east.local`. This is a local sign-in alias; the app sends no email. The one-use setup link was provided in chat and is not retained in documentation. The user chooses the password and enrols an authenticator.

After signing in at `http://localhost:3000/staff/login`, add approved communities in **Categories & places**, create separate officer/approver setup links in **Staff access**, then review a representative project through publication. Two independent people remain required for real publication.

## Remaining work and limits

- User review, real branding/assets, verified community names, attribution, and representative constituency data remain outstanding.
- Live Google OAuth callbacks/account linking and Linux Docker/Coolify/volume validation remain Phase 1 environment acceptance items. Windows standalone checks do not establish Linux container readiness.
- Expanded public filters, maps, Contact, metadata/social previews, and further public design refinement remain Phase 3. Home category counts currently reflect the latest 100 project cards; replace these with full grouped counts during Phase 3.
- Engagement, exports, browser push, and PWA are Phase 4. Off-server backups, restore drills, load testing, final accessibility verification, training, and launch remain Phase 5.
- PDF structural checks are not antivirus scanning. Reviewers must check public prose and documents for internal financial information; structured field isolation cannot detect every sensitive sentence or scanned document.
- No production or staging resource, remote account, or paid service was changed. The user explicitly chose no staging environment.
