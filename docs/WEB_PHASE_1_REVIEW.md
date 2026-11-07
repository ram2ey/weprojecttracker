# Web delivery Phase 1 — local candidate review

Review date: **7 November 2026**. Owner of technical verification: implementation. Owner of design/behavior acceptance: user. This follows [the web delivery plan](WEB_DELIVERY_PLAN.md), separate from the earlier Android-readiness phase numbering.

Status: **technical verification passed; design approved; user authorized production release on 7 November 2026**. The user requested committing the reviewed changes and merging to main for Coolify redeployment, accepting the locally tested candidate for release. This is not client handover/payment acceptance or a claim that the user personally exercised every workflow.

## Candidate

Base commit: `4525ea002f6302a9037d8bacc27e27d8118750dd`, plus the existing local public-register hero/CSS changes and `public/images/register-hero.webp`. These changes are uncommitted. No application code was changed during this verification pass.

Production build ID: `3fSe62H39Bp-xNjOI4vrB` (`.next-build`). Acceptance build ID: `256ljdYTJdHvpX_bXxWrh` (`.next-test`). The builds use separate directories.

## Technical evidence

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 22 passed |
| `npm run test:acceptance` | 69/69 passed across 360px, 430px and 1440px; 2.3 minutes |
| `node scripts/build-production.mjs` | Passed; runtime database/auth/provider credentials empty during build |
| `node scripts/check-production.mjs` | Passed: routes, retired endpoints, redirects, private staff access, migration-aware readiness, unavailable-database rejection, accessible 404 and error/Retry states |
| `git diff --check` | Passed |

The initial sandboxed unit run could not reach its local monitor fixture. Repeating with local networking available passed all 22 tests; no application fix was needed. PostgreSQL setup similarly required local loopback access.

Acceptance uses only `wassa_test` on the isolated PostgreSQL cluster. It covers the 200-project register, title/code/community search, combined filters, removable choices, pagination, public/project/About/staff accessibility, independent publication, returns, revisions, withdrawal, historical-media privacy, password changes/resets/expiry, access revocation, concurrent sign-ins, conflicts and unsaved-work recovery at 360px, 430px and 1440px.

Implementation visually inspected the existing phone/desktop hero captures and refreshed phone staff/long-text project captures. This inspection does not constitute user acceptance. The extreme long-text project capture deliberately uses synthetic text, a solid-color photo and 200% text scaling.

## User review checklist

The verified candidate is running at [localhost:3002](http://localhost:3002), using the preserved development database. This preview was started only after confirming the port was unused; the old `.next-ci` output remains intact. The current review server uses `.next-build`: stop it before rebuilding that directory. Restart with `node .local/web-phase1-preview.mjs` after production build/smoke verification. No real launch projects have been added; use the acceptance artifacts for populated project/staff evidence.

Keep these items open until the user has reviewed them. Record requested corrections before marking any item accepted.

On 7 November 2026, the user confirmed: “Everything looks good on design.” Design approval is recorded for the reviewed candidate. This does not imply that the user personally exercised every workflow or accepted functional behavior; the user asked for confirmation of the functionality checks.

- [ ] Public register: portrait/crop/overlay, heading wording, search placement and empty-state wording.
- [ ] Phone/desktop behavior: filters, clear/remove actions, results, pagination and keyboard focus.
- [ ] Project page: title/community/status, description, photographs/captions, source and latest approved date.
- [ ] About, missing-page and temporarily-unavailable/Retry wording.
- [ ] Staff workflow: private save, submit, separate approval, return/correct/resubmit, revision and withdrawal.
- [ ] Accounts and recovery: temporary-password change, reset/access controls, unsaved-change warnings and conflict-copy recovery.

Screenshots are local ignored artifacts, with fixture data rather than real launch content:

- `.local/phase1-phone-register.png`: current production phone register/empty state after smoke verification.
- `.local/hero-1440.png` and `.local/hero-360.png`: existing hero review captures.
- `.local/minimal-<layout>-staff.png`: refreshed staff screens from acceptance.
- `.local/phase1-<layout>-detail.png`: refreshed long-text project screens from acceptance.

## Findings and limits

No local application defect was identified in this pass. All listed technical checks passed. The user approved the design and subsequently authorized release of the tested candidate.

The existing limits remain: unsaved edits are not durable across browser/OS termination; real launch content, photograph permissions, publisher/contact/privacy wording and mailbox verification belong to web Phase 2. Final-host behavior and release verification belong to web Phase 3. Android hardware acceptance remains deferred. This review adds no new accepted deferral.

The original local verification made no deployment, merge, push, purchase or production-data change. The user's subsequent explicit commit/merge/deployment instruction authorizes the release as a separate action. Client handover and payment remain separate.
