# Phase 2 delivery status — 6 November 2026

The engineering work is implemented. Current Linux CI results are linked below. **Phase 2 is not fully closed:** backups/restore are deferred by the user, while permanent-domain/TLS and live rollout/monitor acceptance still need live access and the coordinated release. No main merge or production deployment was performed.

## Implemented

- Pull-request validation before publication: lint/types/unit checks, isolated PostgreSQL/Chromium acceptance with 200 synthetic projects, the real legacy migration chain and a disposable Linux container rollout test.
- Immutable paired-image release identifiers, migration-success audit markers and fail-closed production readiness.
- Compose preflight before image changes; it blocks retired/extra services, altered persistent volumes, runtime release overrides, missing migration dependencies and exposed PostgreSQL ports. Parse errors do not print saved Compose contents.
- Deployment polling that rejects healthy old containers and missing migration markers, followed by public-route/project/media smoke where approved records exist.
- Independent GitHub uptime workflow and a real loopback HTTP outage/recovery regression test. The user selected their GitHub Actions notifications and owns incident triage. Monitoring stays inactive until the permanent hosted release is verified.
- Updated Docker build context, controlled-build release arguments, deployment documentation and [release/recovery runbook](PHASE_2_RELEASE_RUNBOOK.md). Matching demo/final-domain Compose definitions are prepared and preserve existing storage.

## Local evidence

Lint and TypeScript pass; 22 unit tests and 69 browser checks pass. The browser suite covers 360px/430px phones and desktop, independent publishing, concurrent edits, password/session boundaries, private historical media, accessibility and 200-project browsing.

The migration rehearsal passed from the real 0003 schema through 0004–0006, including a retry. Existing hashes, historical revisions, financial JSON, legacy tables and stored media bytes are unchanged; deterministic usernames, session invalidation, 24-hour transition windows and operator maintenance recovery pass. Fixtures are synthetic; this is not a production backup restore.

The production build succeeds without retired secrets. Production smoke verifies expected release/migration readiness, a 503 for an unmatched release, a 503 for an unavailable database, public error/Retry accessibility, retained/removed routes and private staff access. The monitor process correctly fails on HTTP outage and absent migration proof, then passes after recovery. `npm audit` reports zero vulnerabilities.

## Live configuration and remaining acceptance

- Existing GitHub deployment connection is retained. `PUBLIC_APP_URL` is prepared as `https://wassaeastprojecttracker.com`; `MONITOR_ENABLED=false` until cutover. No secret values changed.
- Backblaze B2 setup, recovery targets and backup/restore remain explicitly deferred. No recoverable external copy is known.
- The old live app remains on its existing saved Compose and demo tunnel. Live DNS/TLS, final-host secure cookies/proxy/rate limits, the real service status response, saved Compose transition and production workflow acceptance remain open.
- Browser approval review could not open Coolify because its usage limit was reached. No domain/Compose changes were attempted through another path. Continue live work when access returns; the exact reviewable transition is documented in the runbook.
- The current Coolify token expires **6 December 2026**. Rotate it directly into the existing repository secret before expiry. Never send tokens or temporary staff passwords through chat or public logs.

## GitHub verification

The [current draft PR checks](https://github.com/ram2ey/weprojecttracker/pull/1/checks) show validation for the latest revision. [Initial run 42307413815](https://github.com/ram2ey/weprojecttracker/actions/runs/42307413815) passed checks, all 69 Linux browser checks, the migration rehearsal and the full container rollout rehearsal. Its final image jobs found an unset pull-request publish input; this is corrected with explicit booleans and the full pipeline reruns on the updated branch. Only a revision with all five required checks green is eligible to merge. No validation run publishes or deploys.

Main protection was applied and read back through GitHub: strict/current `checks`, `acceptance`, `container-rollout`, `images (web)` and `images (tools)` are required, as are a pull request and resolved conversations. Protection applies to administrators; force pushes and branch deletion are disabled. No additional reviewer is required for the single-maintainer repository. The editorial independent-approval rule is unchanged. See the historical [read-only inventory](PHASE_2_INFRASTRUCTURE_AUDIT_2026-11-06.md) for exact retained volumes and current image references.
