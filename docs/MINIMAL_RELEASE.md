# Minimal release implementation — 5 November 2026

## Audit fixes — 6 November 2026

The three findings in `MINIMAL_APP_AUDIT_2026-11-05.md` are resolved: removed filters reset their controls, tracking parameters no longer invalidate public register links, and password-screen/workspace sign-out share checked, retryable failure handling. Updated verification: **48 browser checks, 8 unit tests, lint and type checking passed**. The local preview on port 3002 now uses the verified updated build. The original release verification below is retained as its implementation record.

## Delivered

The application is now a light-only public project register, individual project pages and About. The register is the homepage; `/projects` redirects with its query string. Search supports title, displayed project code and community, with category/community/status filters, removable active choices and pagination.

Projects use the essential launch fields and images only. All six statuses remain; completed projects require a completion date, summary and photograph. Only the latest approved record and its current photographs are public. Private revision history, independent approval, returns, withdrawal, concurrency checks, unsaved-navigation warnings and a copyable conflict-recovery view remain available to staff.

Staff sign in with unique, case-insensitive usernames and passwords. Operators can create editors/approvers, reset passwords, revoke sessions and deactivate/reactivate accounts. Temporary passwords must be changed before workspace access. The last active operator cannot be deactivated. Google, email sign-in and MFA/setup endpoints are unavailable.

Engagement, maps, following, notifications/inboxes, offline/PWA, announcements, reports/exports, themes and decorative motion have been removed from application routes and code. Their legacy tables/data remain stored. Deployment no longer includes a worker or requires retired provider secrets. The temporary retirement worker clears only this app's previous offline caches and unregisters.

## Verification

| Check | Result |
| --- | --- |
| TypeScript | Passed, including standalone build type checking |
| ESLint | Passed |
| Unit tests | 7 passed |
| Browser acceptance | 42 passed at 360px, 430px and 1440px; about 3.3 minutes |
| Migration metadata | `drizzle-kit check` passed |
| Credential-free production build | Passed using `.next-ci`; a stale generated cache was cleared after a Windows Turbopack helper failure |
| Production smoke | Minimal routes, removed routes, query-preserving redirect, private staff access, readiness and unavailable-database behavior passed |
| Production npm advisories | Zero reported by `npm audit --omit=dev` |
| Whitespace | `git diff --check` passed |
| Manual visual review | Final public register and authenticated editor screenshot reviewed |

The acceptance matrix covers 200 seeded projects, combined filters and code search, real screen-based publication, self-approval prevention, conflicting writes, returns, withdrawal, completed-photo validation, rejected PDFs/legacy fields, private historical images, account resets/deactivation/revocation, first-login password changes, login throttling, unsaved link/Back navigation, conflict recovery, accessibility and actual offline-worker retirement. Fixtures use only the isolated local `wassa_test` database and are removed afterward.

The development database was upgraded locally. Before/after digests confirm that account password hashes, revision payloads/financial data and media references did not change. The additive migration assigns usernames, requires a password change and revokes previous sessions; it does not delete legacy feature data or files.

The full dependency audit also reports eight moderate advisories in development lint tooling through the `typescript-eslint`/`minimatch` chain. These are outside the production dependency tree. No automatic force upgrade/downgrade was applied to the framework tooling.

## Local handover

A review server is available at [localhost:3002](http://localhost:3002), using the preserved development database. It currently has no published launch projects; sample records are no longer shown.

The existing local operator is `operator_1`. This account had no credential password before the conversion. To initialize its temporary password from the trusted local terminal, run:

```text
npm run staff:accounts -- operator_1
```

The command displays a temporary password once. Sign in at `/staff/login` and choose a new password. Other staff can then be created from the Staff screen. No password was silently assigned to the existing operator during this change.

For a fresh installation without an operator, use `npm run staff:bootstrap -- operator "Platform operator"` instead. See the README and deployment notes for complete setup.

## Remaining production work

No remote deployment was performed. Real project entry/photography, user review, target Linux image/runtime checks, HTTPS and persistent volumes remain launch acceptance tasks. Spreadsheet import, backup infrastructure and a new visual direction remain outside this change. Historical phase documents and the earlier audit describe the pre-reduction application.
