# Phase 2 delivery status — updated 7 November 2026

Engineering and permanent-domain setup are implemented and verified. **Phase 2 is not fully closed:** backups/restore are deferred by the user; reduced-app rollout and monitoring acceptance require the coordinated release. The existing app was restarted only to apply domain/origin changes. No main merge, new image release or new migration was applied. See [domain verification](PHASE_2_DOMAIN_VERIFICATION_2026-11-07.md).

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

- Existing GitHub deployment connection is retained. `PUBLIC_APP_URL=https://wassaeastprojecttracker.com`; `MONITOR_ENABLED=false` until the reduced-app release. No secret values changed.
- Backblaze B2 setup, recovery targets and backup/restore remain explicitly deferred. No recoverable external copy is known.
- The old live app keeps its existing image pair, worker and demo tunnel. The reduced Compose/migration release, final-host secure cookies/proxy/rate limits, real service status response and production workflow acceptance remain open.
- Browser access recovered after an initial approval-review usage limit. The existing server address is verified as `46.62.214.164`; its public HTTP listener answers. The shared Traefik proxy is running with pre-existing pending changes; those changes and its restart were left untouched.
- The HTTPS apex route on web port 3000 and www→apex redirect are active. Both names have trusted certificates. Nakroteck has only the new server A records for apex/www; mail/TXT records are unchanged. `APP_URL` uses the permanent origin and the current app version was restarted. Public pages/readiness, canonical/social/sitemap origins and path/query-preserving redirects pass. Old cached parking answers can persist until TTL expiry.
- The current Coolify token expires **6 December 2026**. Rotate it directly into the existing repository secret before expiry. Never send tokens or temporary staff passwords through chat or public logs.

## GitHub verification

The [current draft PR checks](https://github.com/ram2ey/weprojecttracker/pull/1/checks) show validation for the latest revision. [Run 42308339520](https://github.com/ram2ey/weprojecttracker/actions/runs/42308339520) passed all five required checks for code revision `693d1b4`: checks, acceptance (69 passed), migration rehearsal, container rollout and both Linux images. The deployment job was skipped and registry-publishing steps were skipped. An unset pull-request publish input found in the first run was corrected with explicit booleans. Only a revision with all five required checks green is eligible to merge.

Main protection was applied and read back through GitHub: strict/current `checks`, `acceptance`, `container-rollout`, `images (web)` and `images (tools)` are required, as are a pull request and resolved conversations. Protection applies to administrators; force pushes and branch deletion are disabled. No additional reviewer is required for the single-maintainer repository. The editorial independent-approval rule is unchanged. See the historical [read-only inventory](PHASE_2_INFRASTRUCTURE_AUDIT_2026-11-06.md) for exact retained volumes and current image references.
