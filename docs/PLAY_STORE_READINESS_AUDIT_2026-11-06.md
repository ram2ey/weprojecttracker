# Wassa East register: application and Google Play readiness audit

Audit date: **6 November 2026**. Audited: current local working tree, including the reduced register and fixes, rather than only the GitHub commit. The reduced app remains uncommitted locally; the recent live release published deployment automation around the older app. A successful deployment-automation run does not establish that the reduced app has been released.

**Assessment: a sound, tested web register; not ready for Google Play submission.** The principal blockers concern Android delivery, privacy/publisher transparency, content and production operations. No critical or high-severity exploitable security defect was confirmed in the inspected paths. The priorities below include release prerequisites and engineering risks; they are not all application bugs or policy violations.

The minimal scope remains appropriate. Public accounts, comments, notifications, maps, financial reporting, dark mode and full offline project storage are not necessary additions merely to reach Play. The existing separation of editor and approver should remain.

## Verification and coverage

| Check | Fresh result |
| --- | --- |
| Unit tests | **15 passed** |
| Lint and TypeScript | Passed |
| Built-server browser acceptance | **48 passed**, across 360px, 430px and 1440px layouts |
| Production compilation | Passed in the acceptance harness |
| Production startup/route smoke | Passed, including removed routes, redirects, private access, and unavailable-database readiness |
| Production dependency audit | **0 known advisories** reported by npm |
| Complete dependency audit | **8 moderate advisories**, in the development-tooling dependency chain; 0 high/critical |
| Browser inspection | Public register and staff sign-in inspected at 360px; register overflow checked at 800×360 landscape |
| Automated accessibility | Acceptance suite reports no axe violations for the tested public pages, register/detail, login, staff register, review queue, staff, communities, audit and editor |

The acceptance run includes 200 synthetic projects, combined filters and displayed-code search, pagination, actual editor/approver screens, independent approval, concurrent edits, return/revision/withdrawal, completed-project rules, image validation, private historical media, exclusion of legacy fields, password-change restrictions, account/session revocation, username login throttling, unsaved-edit guards and service-worker retirement. The three findings in the previous reduced-app audit remain covered and pass.

The first test attempt collided with the preview's `.next-test` build output. Tests were rerun with an ignored audit harness using `.next-ci`, and the local preview was restored on the verified build. No application source was changed to resolve that test-runner collision. Tests used the isolated local `wassa_test` database. No live account, project or deployment was changed by this audit.

Commands used: `npm test`, `npm run lint`, `npm run typecheck`, `npx playwright test --config=.local/audit.acceptance.config.ts` (the isolated build-directory workaround), `node scripts/check-production.mjs`, `npm audit --json`, and `npm audit --omit=dev --json`.

Remaining validation: an actual Android artifact, physical Android devices, TalkBack, large system text, keyboard/inset behavior, process termination/resume, network interruption, sustained target-host load, recovery from backup and a production review of real project content. No Lighthouse score, Android crash/ANR result, or penetration-test certification is claimed.

## Prioritized work

“Blocker” means required before the relevant release. “P1” means important for reliable production. “P2” means address before Android beta or record an explicit decision to defer. Evidence distinguishes inspected code from items outside this repository.

| ID | Priority | Finding or prerequisite | Address by |
| --- | --- | --- | --- |
| A01 | Play blocker | No Android package, manifest or app/site association | Android build |
| A02 | Play blocker | Public deployment still uses a temporary Cloudflare address | Stable-domain release |
| A03 | Play blocker | No published privacy policy or completed data inventory | Play submission |
| A04 | Play blocker | Publisher, government affiliation and support responsibility are unclear | Content/legal sign-off |
| A05 | Play blocker | Signing, target SDK, Play account and submission declarations remain unverified | Play submission |
| A06 | Content blocker | Local public register contains zero published records | Public/store launch |
| A07 | P1 | Backups and successful recovery are not established by the project | Production release |
| A08 | P1 | CI does not run browser acceptance; service deploy success does not verify health | Unattended production releases |
| A09 | P2 | Android lifecycle/network recovery is untested; staff edits exist only in memory | Android beta |
| A10 | P2 | Android touch-target and device-layout work remains | Android beta |
| A11 | P2 | Agreed Creato typography has been replaced by system fonts | Visual sign-off |
| A12 | P2 | Temporary staff passwords have no separate expiry | Staff security hardening |
| A13 | P2 | CSP provides limited defense; production proxy controls need validation | Production security review |
| A14 | P2 | Eight moderate development-tool advisories need a tested dependency resolution | Maintenance cycle |
| A15 | P2 | Representative mobile performance and target-host capacity are unmeasured | Performance sign-off |
| A16 | P2 | Monitoring, credential renewal and operating ownership need an explicit process | Operations sign-off |

### A01 — Build the Android delivery layer

The repository is a Next.js server application. No Android project, `AndroidManifest.xml`, Gradle configuration, signed Android App Bundle, web app manifest or `/.well-known/assetlinks.json` was found. These are expected gaps at this stage, not regressions from the minimal web plan.

**Recommended starting point:** a public-facing Trusted Web Activity (TWA) generated with Bubblewrap, with staff administration remaining a web workflow. TWA can reuse the hosted register and verify the app/site relationship with Digital Asset Links. This is an architectural recommendation, not a guarantee of Play acceptance. [Android TWA overview](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities), [Bubblewrap quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start/).

Acceptance: select a durable package identifier and app owner; add the web manifest and suitable icons; generate an Android project and signed AAB; publish association data with the correct Play app-signing certificate fingerprint; verify the installed Play-track build opens the correct origin. Decide explicitly how the Android app handles the website's Staff sign-in link.

The database-backed server components and APIs must continue to run on the server. Bundling this repository's server-rendered pages into a static mobile package is not a drop-in conversion. A Capacitor/native client would require a separate client/API architecture and additional cookie/origin, link and native-bridge testing. Choose that path only when concrete native functionality justifies it.

Do not replace the retiring `/sw.js` with an offline cache as part of packaging by default. App identity/manifest work and historical-content caching are different concerns. Preserve the current withdrawal and historical-media privacy guarantees.

### A02 — Establish a durable origin

The recorded live address is a `trycloudflare.com` temporary hostname, accessed through a separate connector. The audit did not change it. A stable controlled HTTPS origin is necessary for a maintainable app identity, public links, authentication origins, store support/privacy URLs and TWA association.

Acceptance: move to an owned domain; configure TLS and the canonical/authentication origin; verify image requests, redirects, sitemap and social previews; host Digital Asset Links without redirects; retain existing database/media volumes. Plan old-link handling. Test the signed Android build against this final origin. Temporary tunnels remain useful for development.

Evidence: `compose.coolify-demo.yaml:1`, `src/lib/site.ts:3`, `src/lib/auth.ts:13`, and the recorded deployment verification in `docs/AUTOMATIC_DEPLOYMENT.md`.

### A03 — Publish privacy information and inventory actual data

There is no privacy route or privacy link in the public footer. Google requires an accessible privacy policy in the app and Play Console, and a Data safety declaration even for an app declaring no collection. [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311), [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).

The inventory must distinguish anonymous public browsing from staff use. Inspected storage includes staff names/usernames, password hashes, sessions with IP/user-agent fields, audit history, project text and photographs. Hosting/tunnel logs and any later crash/analytics SDK also need review. No public registration, advertising SDK or public tracking analytics was found in the inspected application code; that alone does not justify a “no data collected” declaration.

Acceptance: identify the responsible publisher/contact, data purposes and processors, retention periods, security controls, deletion/contact process and photograph publication rights. Include people visible in photographs, particularly schoolchildren/patients, in the content-review procedure. Keep tokens, passwords and private project text out of diagnostics. Match the declaration to the final Android app and infrastructure.

Public self-service account deletion should not be added merely to satisfy an assumed requirement: public users currently have no accounts. Reassess the applicable account-deletion rules if account creation is later exposed in the Android experience; staff deactivation is not deletion.

Evidence: `src/components/site-footer.tsx:3`, `src/db/schema.ts:39`, `src/lib/security/accounts.ts`, and `src/lib/content/media.ts`.

### A04 — Clarify publisher, authority, sources and support

The header uses the constituency identity/crest. About explains the editorial process but does not identify the maintaining organization, its relationship to government/party/MP office, public support contact, or responsibility for correcting information. No public support link is provided. The audit cannot establish authorization to use the identity from source code.

For government information, Play requires clear sourcing and truthful affiliation; this is particularly relevant to a public constituency-project register. Determine the app's actual status before writing any disclaimer. An authorized government app and an independent/party-run register require different descriptions. [Government-information requirements](https://support.google.com/googleplay/android-developer/answer/9514050).

Acceptance: name the publisher in About and the store listing; state affiliation accurately; verify branding rights; provide a maintained support/contact route. A simple contact link can satisfy the product need without restoring the retired feedback/moderation system. Give verifiable source URLs where available. The current source field renders as plain text, so a URL is not tappable on a phone. Any link rendering must allow only safe URL schemes and preserve text escaping.

Evidence: `src/components/site-brand.tsx:3`, `src/app/(public)/about/page.tsx:10`, `src/components/site-footer.tsx`, `src/components/content/published-content.tsx:77`.

### A05 — Prepare Play account, signing and review requirements

No Play Console account, verification state or Android signing assets were inspected. As checked for this audit, new standard phone/tablet apps must target **Android 16/API 36 or higher**. Recheck at submission time. [Current target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk).

Acceptance: establish the publisher/account type, Play App Signing and secure upload-key recovery, package/version scheme, current SDK/toolchain, content rating, target audience, ads declaration, government-app declaration where applicable, privacy/Data safety, store icon/screenshots/description and a reachable support contact. If staff features are included, provide review access/instructions that allow the reviewer to exercise them. Do not introduce restricted device permissions without a feature requiring them. [App signing](https://developer.android.com/studio/publish/app-signing).

Government apps require the appropriate organization-account setup; determine whether that category actually applies. New personal accounts created after 13 November 2023 may require a closed test with at least **12 continuously opted-in testers for 14 days** before applying for production access. This condition is not universal to all accounts. [Account types](https://support.google.com/googleplay/android-developer/answer/13634885), [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

### A06 — Prepare useful, verifiable launch content

The inspected local register displays zero published projects. Automated tests provide synthetic records, not launch content. A useful searchable register with maintained data is a stronger product than an empty wrapper; an empty initial app creates a substantial utility/review risk. No claim is made that TWA or web-based apps are categorically rejected. [Play functionality/content policy](https://support.google.com/googleplay/android-developer/answer/9898783).

Acceptance: manually enter a meaningful initial set of approved projects with clear descriptions, communities, source evidence and licensed/approved photographs; verify completion claims and dates; review all six status labels and long text with real content. Capture store screenshots from the actual release experience. The limit of 200 is a supported scale, not a minimum launch-data requirement.

### A07 — Establish backup and recovery

Compose persists PostgreSQL and media in volumes. This protects against container replacement, not host loss or mistaken changes. The deployment notes require compatible backups, but no backup/restore implementation or successful recovery exercise is evidenced in the repository. External backups may exist; this audit did not inspect the server or claim that they do not. This was previously deferred and remains an operational dependency.

Acceptance: document an owner, off-host encrypted database/media backups, retention, access and recovery targets; restore into an isolated environment and verify accounts, approved projects, revision history and image access. Retain previous image references and preserve any historical encryption keys needed for legacy data. Test migration 0004 on a production-shaped copy before the reduced app's first live deployment. Code-image rollback alone cannot undo data migrations.

Evidence: `compose.coolify.yaml`, `docs/DEPLOYMENT.md:29`, `docs/DEPLOYMENT.md:51`, `drizzle/0004_minimal_register.sql`.

### A08 — Strengthen automatic release verification

The GitHub workflow runs lint, types and unit tests, then builds images. It does **not** run `test:acceptance`. In the selected Coolify **service** path, the script treats acceptance of a redeploy request as success; it does not wait for the replacement containers, migration or live release to become healthy. Application-type resources have a deployment-status poll, but that branch is not used for this resource.

Acceptance: run the retained browser suite in CI against a disposable PostgreSQL service before deployment. After redeploy, verify completion plus the expected running release identity, then public readiness and representative routes. Readiness alone can succeed against an old still-running container. Fail the release on an unsuccessful migration/unhealthy replacement, and define recovery. Configure required checks/branch protection so direct-main pushes do not bypass review. Keep automatic deployment after checks; a manual gate is not inherently required.

Evidence: `.github/workflows/container-images.yml:43`, `scripts/coolify-deploy.mjs:118`, `scripts/coolify-deploy.mjs:148`. The previous successful first release included manual container/HTTP checks; those checks are not yet automated.

### A09 — Test Android lifecycle and interrupted work

Desktop-Chrome phone viewports do not exercise Android Back/predictive Back, app switching, renderer/process termination, connectivity changes, system text size or a real soft keyboard. The current editor stores unsaved payloads in React memory and uses browser confirm/beforeunload/history guards. Those checks pass in Chrome; they do not provide durable recovery if Android kills the process.

Acceptance: test install/cold start, background/resume, rotation, Back, deep links and loss/recovery of connectivity. Provide a deliberate offline/unreachable-server state with Retry; full offline project caching is not required. If staff editing stays on the web, explicitly test it on supported mobile browsers; if included inside Android, add a secure durable-draft/recovery design. Avoid storing sensitive private drafts indefinitely on shared devices. Current conflict-copy recovery should remain available.

Evidence: `src/components/content/record-editor.tsx:33`, `src/components/content/unsaved-changes.ts:59`, `src/app/(public)/error.tsx`. The error boundary handles server-render failures, not every native startup/network failure.

### A10 — Finish Android interaction and accessibility review

At 360px, measured public navigation/buttons are generally 44px high; the search input/filter summary are 46px. The empty-state Clear filters link is 21px high. These are observed CSS dimensions; physical Android sizing still needs device verification. Android recommends 48dp touch areas. This is a platform-usability gap, not a claim that every 44px control fails WCAG. [Android touch-target guidance](https://support.google.com/accessibility/android/answer/7101858).

Acceptance: adopt a 48px-equivalent minimum interactive target where practical; enlarge small standalone actions; manually test TalkBack, largest text, external keyboard, portrait/landscape and status/navigation-bar insets in the actual package. The current header/search stack occupies much of a 360×800 first screen; make the first project easier to reach while retaining identity and visible search. Check full-photo links and return navigation inside the Android container. A public-app shell can simplify repeated Staff sign-in navigation if staff remain web-only.

Evidence: `src/app/globals.css:220`, `src/app/globals.css:251`, `src/app/(public)/page.tsx`, `.local/play-audit-register-360.png`. No horizontal overflow was observed at 360px or 800×360.

### A11 — Restore or explicitly approve the typography change

The minimal-release plan retained existing typography. Creato Display files and the licence remain under `src/app/fonts`, but no `next/font/local`, `@font-face` or other Creato registration is used. The stylesheet selects system fonts; browser computed style confirms that stack. This is a confirmed visual regression against the agreed plan, not an Android policy issue.

Acceptance: restore the agreed local font through a tested loading/fallback strategy, or explicitly approve the system-font change and update the design documentation. Verify actual font loading and Android glyph/text scaling rather than only checking that font files exist.

Evidence: `src/app/globals.css:17`, `src/app/globals.css:32`, `src/app/layout.tsx`, `src/app/fonts`.

### A12 — Time-limit temporary credentials

Generated passwords are strong and first-login/reset password changes are enforced; resets revoke sessions. However, `mustChangePassword` has no corresponding temporary-credential expiry in the inspected schema/service. An unused issued password can remain valid indefinitely. No bypass of the forced-change gate was found.

Acceptance: choose a documented short activation lifetime, enforce it server-side, require a new reset after expiry and test it. Continue one-time display, private delivery and immediate revocation. Password-only staff login is an agreed scope decision and is not counted as a missing feature. Protect GitHub, Coolify and Play Console administrative accounts with their own platform security controls.

Evidence: `src/lib/security/accounts.ts:20`, `src/lib/security/accounts.ts:123`, `src/db/schema.ts:85`.

### A13 — Complete security-header and proxy hardening

Current CSP constrains framing, objects, base URI and form destinations, but does not define `default-src`, `script-src` or `connect-src`. This leaves less defense if an injection is later introduced. Inspected React text output is escaped and JSON-LD escapes `<`; no working XSS was demonstrated.

Acceptance: design a Next-compatible nonce/hash CSP and explicit resource/connect restrictions; test it with hydration, images and auth before enforcing it. Validate HTTPS redirects/HSTS at the actual proxy, secure cookies, trusted forwarded-IP handling/rate limits and no public database exposure on the final domain. Proxy-level controls were not audited and must not be inferred absent solely from Next configuration.

Evidence: `next.config.ts:38`, `src/lib/security/http.ts:2`, `src/lib/auth.ts:36`, `src/components/content/published-content.tsx:13`.

### A14 — Resolve development-tool advisories deliberately

Fresh npm results: production dependency graph 0 advisories; full graph 8 moderate advisories through `eslint-config-next`/TypeScript ESLint/minimatch, including [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). These are development-tool findings, not eight demonstrated vulnerabilities in the public register. The tools Docker target installs development dependencies, so distinguish that image from the standalone web runtime.

Acceptance: upgrade/override to a compatible patched dependency graph and rerun lint/types/build/tests. Review npm's proposed changes rather than applying `npm audit fix --force`: the reported automatic remedy crosses major versions. Prefer explicit top-level version ranges and scheduled dependency review; the lockfile already gives reproducible installs.

Evidence: `package.json`, `package-lock.json`, `Dockerfile`.

### A15 — Measure performance with real content and a realistic network

The 200-record test establishes functional browsing, not a load/performance budget. `projectView` queries attachment eligibility per record, so a 24-card page with photographs adds per-record database reads on top of the list/count/community queries. This is bounded at launch size and was not demonstrated to be too slow. No full-register cache should be restored merely to optimize this.

Acceptance: run Lighthouse/mobile-network measurements against representative photo-heavy pages, measure LCP/INP/CLS and transferred image sizes, then test the configured server under expected concurrent readership. If measurements warrant it, batch attachment checks into one query and review SQL plans/indexes. Keep current-approved-media authorization, no-store withdrawal behavior and server-only data projection intact. Use an explicit performance budget rather than a synthetic empty-register score.

Evidence: `src/lib/content/public.ts:16`, `src/lib/content/public.ts:102`, `src/components/project-card.tsx`, `src/lib/content/media.ts`.

### A16 — Assign operational ownership and credential renewal

Liveness/readiness endpoints, bounded Docker logs and an audit trail exist. The repository does not establish externally hosted availability monitoring, error-triage ownership or backup verification. The new Coolify token expires on **6 December 2026**. Its accepted team-wide Read/Write/Deploy permissions are broader than this workflow's single-resource target.

Acceptance: assign owners for outages, editorial correction, dependency updates, backups, domain/TLS, signing keys and secret renewal. Record token expiry/rotation and restrict repository access. Where supported, narrow deployment access to the app or an isolated team. Add an independent health monitor and actionable error capture with sensitive-data scrubbing. Running the only monitor on the app's own server would not detect host loss reliably. Any external notifications or monitoring services need a separate configuration decision; none were activated here.

Evidence: `src/app/api/health/route.ts`, `src/app/api/ready/route.ts`, `src/lib/content/api.ts:33`, `docs/AUTOMATIC_DEPLOYMENT.md:23`.

## Tools worth using

Start with the existing test stack plus the Android build tool; avoid adding multiple services before there is an owner for them.

| Tool | Purpose for this app | When |
| --- | --- | --- |
| [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), optionally [PWABuilder](https://www.pwabuilder.com/) | Generate and maintain a TWA Android project around the hosted register | After domain/publisher decisions |
| Existing Playwright + axe | Keep publishing, privacy, account and web accessibility regressions in CI | Now |
| [Android Studio and accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing) | Emulator/device debugging; combine with manual TalkBack, large text, keyboard and Back tests | Android beta |
| [Play Console testing](https://support.google.com/googleplay/android-developer/answer/14151465) and [Firebase Test Lab](https://firebase.google.com/docs/test-lab/) | Internal/closed-track acceptance and optional physical-device coverage | Once an AAB exists; Test Lab is optional and may incur cost |
| [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) | Repeatable mobile web performance and page-quality checks on populated pages | Before performance sign-off |
| [OWASP ZAP baseline](https://www.zaproxy.org/docs/docker/baseline-scan/) | Spider/passive security checks in an authorized test environment | Before release, alongside manual review |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | Independent HTTP/readiness monitoring | When an operating owner/host is selected |

Error tracking such as Sentry is an optional later addition, not a prerequisite library. Evaluate its privacy/data flows before enabling it. No recommended service, paid plan, SDK or infrastructure was installed or activated as part of the audit.

## Delivery sequence

1. Decide the actual publisher/government affiliation and public-only versus staff-inclusive Android scope.
2. Establish the final domain, privacy/support information, launch-content review and a tested backup/recovery process.
3. Address release-health/CI gaps, typography and phone interaction issues; then release the reduced web app and migration together after target-host checks.
4. Build the Android TWA, signing/association data and Play declarations. Keep the retiring service worker and media privacy behavior under regression tests.
5. Run physical-device/accessibility/network/lifecycle tests and the applicable Play testing track. Submit the tested AAB with accurate screenshots and declarations.

No change to the minimal feature scope is recommended solely for store presence. A useful, current register with a reliable Android experience is the intended launch product.
