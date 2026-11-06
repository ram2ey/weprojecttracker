# Reduced app audit — 5 November 2026

**Resolution — 6 November 2026:** All three findings below are fixed. The original audit and evidence are retained for reference.

- **R01:** The register form remounts when normalized URL filter state changes. Regression checks cover dropdown values after chip removal, Clear all, Back and Forward.
- **R02:** Public pages validate only supported register fields and ignore unrelated tracking parameters. Known invalid filters still fail validation, the API remains strict, and canonical URLs stay free of tracking parameters.
- **R03:** Both staff sign-out controls use a shared response check, show retryable errors for non-success HTTP responses and network failures, and redirect only after success. Regression checks confirm that failed attempts preserve the active session and a successful retry revokes it.

Verification after the fixes: **48 browser checks and 8 unit tests passed**, along with lint, type checking and whitespace checks. The acceptance harness built the updated production server and exercised 360px, 430px and 1440px layouts. The local review server at port 3002 was restarted with that verified build and the preserved development database. No remote deployment or database migration was performed for these fixes.

## Assessment

The reduced application matches the agreed launch scope and its main workflows pass the current automated checks. This audit found **three medium-priority issues**, with no confirmed critical or high-priority findings. Two issues were reproduced in the browser; the third is confirmed by the sign-out implementation's error path.

Fix the three issues below before launch, then complete real-content review and target-environment acceptance. This is a local application audit, not approval of a live deployment. No application code, credentials or development project records were changed during the audit.

## Findings

### R01 — Removing a filter leaves its dropdown showing the removed value

**Priority:** P2. **Evidence:** Reproduced in the browser.

Steps:

1. Select Education in the register's Category control and submit the search.
2. Click the “Remove category filter: Education” chip.
3. The URL returns to `/` and the active chip disappears, but the Category control still displays Education. Reading the select's DOM value also returned `Education` at this point.

The server returns results for the cleared query, while the form presents a different selection. Submitting the form again can reapply the filter the visitor just removed. The same uncontrolled-select pattern is used for community and status.

**Cause:** Selects use `defaultValue`; client navigation updates the query/results without remounting the form or synchronizing the existing controls.

**Recommendation:** Synchronize filter controls with the current URL, or remount the form using a normalized filter-state key. Verify removal and Clear all reset the actual control values, including after Back/Forward navigation.

**Locations:** `src/app/(public)/page.tsx:96`; `tests/e2e/register.spec.ts:723`.

**Coverage gap:** The existing filter-removal test checks the URL and remaining chips, but does not assert that the removed filter's dropdown has reset.

### R02 — Ordinary tracking parameters invalidate the register

**Priority:** P2. **Evidence:** Reproduced in the browser and confirmed in source.

Opening `/?utm_source=audit` displays “Please check your filters.” The page passes every query parameter directly to a strict filter schema; an unknown parameter makes parsing fail and substitutes an empty listing. This also affects common tracked links containing parameters such as `utm_campaign` or `fbclid`.

**Impact:** A visitor following a tracked public link can receive an invalid-filter page instead of the register. With published projects present, the failure branch still substitutes a zero-result listing.

**Recommendation:** Extract the supported register fields before validating them. Continue to validate the values of those fields and reject invalid API contracts, while ignoring unrelated page tracking parameters. Keep the canonical URL independent of tracking parameters.

**Locations:** `src/app/(public)/page.tsx:35`; `src/lib/content/filters.ts:21`.

**Coverage gap:** Tests cover malformed or retired filter fields, but do not cover benign tracking parameters on a public page.

### R03 — Password-screen sign-out can redirect without ending the session

**Priority:** P2. **Evidence:** Source-confirmed; no fault was injected into a real account session.

The Sign out button on `/staff/password` awaits `fetch('/api/auth/sign-out')` and then redirects to the sign-in screen without checking the response status. A non-success HTTP response can therefore redirect the user even when the server has not revoked the session. A network rejection has no catch block or actionable error message.

**Impact:** A staff member can be left uncertain about whether sign-out succeeded. In the non-success-response case, arriving at the sign-in screen is not evidence that the previous session ended.

The main staff workspace already checks `response.ok` and reports connection failures, so behavior differs between the two sign-out controls.

**Recommendation:** Share the workspace's checked sign-out behavior with the password screen: inspect the response, catch failures, show a retryable error and redirect only after success. Verify both non-success HTTP responses and rejected network requests.

**Locations:** `src/components/staff/password-form.tsx:92`, `:97`; compare `src/components/staff/console.tsx:72`.

## Fresh verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 7 passed |
| `npm run test:acceptance` | 42 passed; approximately 1.3 minutes |
| Production compilation | Passed as part of the acceptance harness's standalone build |
| `node scripts/check-production.mjs` | Passed: supported/removed routes, redirect, staff access boundaries, readiness and unavailable-database behavior |
| `npm audit --omit=dev --json` | Zero known production dependency vulnerabilities reported |
| Manual public review | Register, category selection/removal and tracked-link behavior inspected in the local browser |

Acceptance checks run at 360px, 430px and 1440px. They cover 200-project browsing, combined filters, code search, real editor/approver publication, self-approval prevention, returns, conflicting writes, withdrawal, completion/photo validation, rejection of excluded fields/PDFs, private historical images, temporary-password restrictions, resets, deactivation, session revocation, username sign-in, forced password change, login throttling, unsaved edits and offline-worker retirement. The configured automated accessibility scans passed for the tested public and staff states.

The test harness uses the isolated local `wassa_test` database and cleans up its synthetic accounts/projects. The production smoke checks also use isolated local infrastructure. The manual public preview uses the existing development database; no real projects were added to it.

## Scope and limits

Source review included public projections, project validation and publication, media authorization, staff accounts/session gates, form behavior, filtering, migration and deployment configuration. The removed engagement, map, reporting and offline features were checked as unavailable surfaces rather than treated as missing functionality. Password-only sign-in and light-only appearance are intentional decisions and are not findings.

No live deployment, real Linux container, HTTPS/proxy behavior, persistence/restore exercise, Safari/Firefox, physical-device behavior or manual screen-reader session was verified here. No fresh sustained traffic/load test was run; the 200-project checks verify functional browsing rather than production capacity under load. Passing tests and a clean production dependency audit do not establish the absence of vulnerabilities.

The eight moderate development-tooling advisories recorded in the implementation notes remain a separate maintenance item; the fresh dependency query in this audit was limited to production dependencies. Real launch content and operator/staff setup remain launch preparation work, not application defects counted above.

## Recommended order

1. Fix filter-state synchronization and add assertions on the actual select values.
2. Permit unrelated public-page tracking parameters without invalidating supported filters.
3. Consolidate sign-out handling and test its failure paths.
4. Rerun the focused regressions and complete target-environment acceptance before launch.
