# Phase 1 follow-up review — 6 November 2026

Status: **review complete; one P1 finding fixed and verified locally**. Scope: independent reread of Phase 1 security, migration, editor/navigation, source-link handling, build isolation and browser runtime errors. Existing uncommitted design/minimal-release work and the running preview are preserved.

## P1 — In-flight sign-in could survive password reset and session revocation

**Confirmed before fixing:** a controlled test paused insertion of a session after the old password had already been verified. An operator then reset the password, and the legitimate staff member changed the replacement temporary password. Releasing the paused sign-in returned HTTP 200; that session could read the protected staff register with HTTP 200. Deleting existing sessions did not cover a session that had not yet been inserted.

**Fix:** additive migration `0006_staff_access_version.sql` adds a default-zero access-version counter to staff. Account reset/revoke/deactivate/reactivate and successful password changes increment it within their existing transactions. The username sign-in wrapper captures it before Better Auth reads/verifies the credential, then compares it after session insertion and before returning the response. A changed version, inactive account or expired temporary credential causes the newly inserted session to be deleted and a 403 response with no session token or cookie. Changes after this final check delete the already-inserted session normally. Better Auth continues to own password verification, sessions and login throttling.

**Boundary hardening:** the wrapper checks origin and bounds parsed sign-in JSON to 16 KB, including streamed bodies through the existing bounded reader. Other auth responses explicitly use private/no-store caching. Migration 0006 changes no hashes, usernames, content, files or history.

**Regression evidence:** the original deterministic reproduction now returns 403 for both sign-in and protected content. The retained test also covers explicit revocation and deactivation followed by reactivation, checks that no token/cookie is returned and checks that no stale session remains stored. All test barriers/fixtures are confined to the disposable local test database and removed afterward.

## Other review results

- Browser probe on the production build: Creato is loaded and applied to body, input and placeholder; no JavaScript errors or CSP violations during normal register, About, sign-in or missing-page browsing.
- Nonces are generated on the server, overwrite supplied nonce/CSP headers and are applied to dynamic HTML/structured data. APIs/media retain their separate response protections.
- Source links retain escaped original text, allow only HTTP(S), exclude URL credentials and use safe external-link attributes.
- Draft validation retains private partial saves; conflict-copy, cancelled revision/reload navigation and independent publication remain covered by acceptance tests.
- Build outputs remain isolated from the active port-3002 preview. No production migration/deployment or development-database conversion is performed by this review.

## Verification and limits

- Type checking, lint and **19 unit tests** pass.
- Complete acceptance suite: **69/69 checks pass**, including the three revocation race scenarios on every layout, body/origin limits, migration preservation and retained publishing/authorization/accessibility coverage.
- Production build, startup/readiness/retired-route/404/error/Retry smoke tests pass.
- Latest `npm audit --json`: zero vulnerabilities. Final browser console/CSP probe: no errors during ordinary browsing; real Creato font loaded.

No unresolved local release blocker was found in the reviewed Phase 1 scope. Android hardware/TalkBack and final-host TLS/proxy/cookie/rate-limit checks remain later-phase acceptance work; this review does not substitute for them or guarantee the absence of every possible defect. Apply migrations 0005 and 0006 together with the matching code when preparing deployment.
