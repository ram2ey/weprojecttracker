# Phase 1 — Web readiness

Updated **6 November 2026**. Status: **complete locally after follow-up security correction**. The original 63-check run missed a concurrent sign-in/revocation race, now reproduced, fixed and covered by the expanded 69-check suite; see [follow-up review](PHASE_1_FOLLOWUP_REVIEW_2026-11-06.md). Phase 0 account/operating tasks remain open. No deployment, Git push, production-data modification or Android submission is part of this work.

## Implementation

| Area | Result and evidence |
| --- | --- |
| Typography | Existing Creato Display regular/medium/bold files restored through `next/font/local`, swap loading and system fallbacks. OFL retained. Browser checks verify an actual loaded font matches the body family. |
| Phone layout and controls | Header/heading spacing reduced; search stays visible. Primary navigation/buttons/inputs/selects/filter chips/pagination and standalone clear/return/source links have 48px minimum height. Long titles, community names, captions and URLs wrap. |
| Draft/submission guidance | Editor explains required launch fields and completed-project requirements. Unfinished drafts still save privately. Client submission feedback lists missing fields; server publication validation remains authoritative. |
| Source links | Valid HTTP(S) URLs become escaped, credential-free links with `noopener noreferrer` and new-tab guidance. Invalid or non-web text stays text. No HTML is accepted from a source string. |
| Full photographs | Same-tab full-image navigation; browser Back returns to the record. Existing current-approved-revision media authorization is retained. Android-specific Back/external-browser handling is validated after packaging. |
| Temporary credentials | New/reset credentials expire after 24 hours. Sign-in hooks, every staff identity check and locked password changes enforce expiry. Password change clears the deadline and revokes sessions; reset/deactivation keep immediate revocation. UI/maintenance commands display the deadline alongside the one-time password. |
| Migration 0005 | Adds nullable `temporary_password_expires_at`; existing accounts still requiring a password change receive one 24-hour transition window from migration time. Permanent passwords, hashes, content, legacy tables/files and history are preserved. Missing deadlines on temporary credentials fail closed. |
| Concurrent sign-in/revocation | Migration 0006 adds a staff access-version counter. Sign-in snapshots it before credential verification and checks again after session insertion. Reset, password change, revocation, deactivation and reactivation increment it transactionally; an outdated sign-in is denied and its new session is removed before any cookie/token is returned. Sign-in request bodies are bounded to 16 KB. |
| CSP | Fresh cryptographic nonce per HTML request via Next.js Proxy; root layout waits for the request. Next framework scripts/styles and structured data receive the nonce. Production has no script `unsafe-inline` or `unsafe-eval`; resources/connections/forms are same-origin and framing/objects are blocked. Style attributes are allowed for Next Image/Radix. Media routes keep their sandbox policy. HTML is private/no-store. |
| Tooling advisories | Scoped override updates only the TypeScript-ESLint consumer of minimatch to 11.0.5. It uses the retained `minimatch(path, pattern, { dot: true })` API. No Next.js downgrade or forced audit fix. Lint/types/build pass and install audit reports zero vulnerabilities. [Upstream advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). |
| Build isolation | Development `.next`, acceptance `.next-test`, production verification `.next-build`; named output overrides supported and validated. Generic generated-output ignores added. Existing `.next-ci` port-3002 preview is preserved. |
| Unsaved edits | Existing navigation, revision, reload and copyable-conflict guards retained. Warnings cannot survive OS/browser termination and are not durable draft storage; README/deployment/design guidance now states this clearly. |

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`: passed; **19 unit tests**.
- `npm run test:acceptance`: latest consolidated run **69/69 checks passed**, across 360px and 430px touch layouts and 1440px desktop, with 200 fixture projects per run. Covers publishing, concurrent writes, self-approval, private historical media, strict public data, account lifecycle/expiry, in-flight sign-in reset/revocation races, sign-in body/origin limits, accessible screens, real login/password changes, search/filter/pagination, actual non-fallback font loading, CSP and source/photo/large-text behavior.
- Cancelled-reload/revision-switch checks pass on all three layouts: the edited text is retained after cancelling revision switching and the native reload warning. Conflict-copy recovery and cancelled link navigation also pass.
- `node scripts/build-production.mjs`: passed using `.next-build`, with runtime database/auth/provider credentials empty during build.
- `node scripts/check-production.mjs`: passed. Tests production routes/retired endpoints, redirect parameters, readiness/private access, a phone-sized empty register, accessible 404/home navigation, and database-failure/Retry accessibility against only the isolated local database.
- Final `npm audit --json`: **zero vulnerabilities**, including development dependencies. `git diff --check` passes. Test fixture cleanup completed; the development database and existing preview were not migrated or overwritten.
- Follow-up runtime probe on the corrected production build: zero normal-page JavaScript/CSP errors; Creato loads and is applied to body/input/placeholder.
- Review artifacts: `.local/phase1-phone-register.png`, `.local/phase1-<layout>-detail.png` (200% text and deliberately long fixture text), `.local/minimal-<layout>-staff.png`. These local ignored artifacts contain fixture content, not launch records.

The CSP regression test inserts an untrusted parser script into the returned HTML, verifies CSP is present and unique per response, verifies normal hydration/font loading, and confirms the injected script does not execute. DevTools-created dynamic scripts can inherit the debugging context's trust and are not used as evidence of untrusted-script blocking.

## Remaining release gates

Implementation owns final-host CSP/origin/proxy/cookie/rate-limit verification in Phase 4. Publisher and implementation own real Android hardware, TalkBack, font/large-text, target-size and Back/external-browser checks in Phase 6, after a packaged candidate exists. Desktop touch viewports do not prove Android behavior. No Android hardware or Coolify/Linux acceptance is claimed here.

Real launch content, affiliation/privacy wording, account verification, backup/recovery infrastructure and deployment continue under their assigned phases. No runtime critical/high advisory or unresolved local regression has been accepted as a release deferral.
