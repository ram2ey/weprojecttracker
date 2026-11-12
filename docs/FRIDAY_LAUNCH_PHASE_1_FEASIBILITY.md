# Friday launch — Phase 1 feasibility

Assessed 11 November 2026. Target: Friday, 13 November 2026.

For the current outstanding tasks and completion status, see the [Friday launch checklist](FRIDAY_LAUNCH_CHECKLIST.md). This report preserves the Phase 1 findings at the time of assessment.

## Decision and status

**Proceed with the notification foundation. Technical feasibility is demonstrated; phone acceptance and production push readiness remain open.** A real Web Push message was accepted by the browser push service and handled by an isolated desktop Chrome service worker after the app page was closed. No production code, database, deployment settings or subscriber records were changed.

This is Phase 1 of the launch plan agreed in the current conversation, separate from the older numbered web-delivery and Play-submission plans. The user's current scope includes both the Updates inbox and phone push. Website installation is required; an APK is optional if verified in time. Android packaging must not displace notification or installation verification.

## Agreed experience

- Five category cards with published-project counts directly below the hero. Current categories: Education, Health, General, Community Development and Social Amenities. Keep community/status filtering in project results.
- Explore projects and Install tracker hero actions; installation also in the header/menu.
- Notification bell beside the mobile menu, opening a full Updates page.
- Separate Save and Follow updates actions. Follow projects, categories or communities.
- Invite phone-alert permission after the first follow, only opening the native permission request after Enable phone alerts is selected. Not now keeps the inbox available.
- New projects, status changes and major approved updates generate relevant alerts; news is a separate opt-in.
- No public sign-in. Preferences and read state belong to the current browser/installation; there is no cross-device recovery promise.
- Slide-up panels on mobile and centred dialogs on desktop.
- Proposed details retained for implementation: For you / All updates, Mark all read, notification settings, and a staff major-update flag reviewed during publication approval.

## Evidence

### Live website, read-only checks

Origin: https://wassaeastprojecttracker.com. Checked over normally validated HTTPS.

| Check                     | Result                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Homepage                  | HTTP 200; Install App and Browse by community present                                     |
| Manifest                  | HTTP 200; id `/`, scope `/`, start URL `/`, standalone display                            |
| App icons                 | HTTP 200; 192x192 and 512x512 PNG; maskable 512x512 PNG                                   |
| Apple touch icon          | HTTP 200; 180x180 PNG                                                                     |
| HTTP and www redirects    | HTTP 302 to canonical HTTPS; path and query retained                                      |
| Readiness                 | HTTP 200; ready and migrated both true                                                    |
| Release identity          | `sha-762c0a4b1dff0044ae7685a276a8ba79a14b1cfa-42921954043-1`                              |
| `/sw.js`                  | HTTP 200, JavaScript, no-cache/no-store, root scope allowed; currently unregisters itself |
| `/api/public/push/config` | HTTP 404                                                                                  |

These results establish served prerequisites, not successful installation on a phone. Older documents describing the live site as the pre-reduction app are historical; the observations above describe this inspection.

### Local baseline

- `npm run typecheck`: passed.
- `npm run lint`: passed before final probe formatting; the final new probe was separately linted.
- `npm test`: 36/36 passed with local networking enabled. The first sandboxed run passed 35/36; the monitor test could not reach its local fixture. Its isolated rerun and the complete network-enabled suite both passed.
- Existing browser acceptance tests contain simulated installation events and explicit assertions that push routes are retired. They must be revised with the new feature, not treated as proof of real installation or delivery.
- No build or database migration was necessary for this isolated feasibility experiment. The full browser acceptance suite was not run in this phase.

### Push experiment

Reproducible probe: `scripts/probe-web-push.mjs`.

Final run: **2026-11-11 23:25:30 UTC**, desktop Chrome **157.0.8103.39**.

| Check                                                                                | Result                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Secure context, Service Worker and Push APIs                                         | Available on trusted loopback origin                                                                   |
| Registration under the app's production CSP                                          | Passed                                                                                                 |
| Synthetic handler smoke check                                                        | Passed; notification recorded by browser                                                               |
| Real browser push subscription                                                       | Created                                                                                                |
| App page closed before sending                                                       | Yes; browser process remained running                                                                  |
| Real push service response                                                           | HTTP 201                                                                                               |
| Worker handled real network push and completed `showNotification` after page closure | Passed                                                                                                 |
| Cleanup                                                                              | Subscription unsubscribed, notifications closed, worker unregistered, temporary browser profile closed |

The experiment uses a disposable normal browser profile, pre-granted notification permission, ephemeral VAPID keys, a loopback HTTP server and a fixed test message. It never accesses the application database or existing subscribers. The Web Push library is installed only under ignored `.local/phase1-push-probe`; root application dependencies are unchanged. Endpoint URLs and keys are not included in reports.

Raw sanitized results are saved under `.local/phase1-push-probe/results*.json` (ignored by Git and Docker). The final successful timestamped report is `results-2026-11-11T23-25-30-633Z.json`.

Earlier runs exposed test-environment limitations: an off-the-record browser context rejected registration; a temporary normal profile succeeded, but subsequent runs returned HTTP 410 and a subscription timeout. The final probe explicitly allows background networking instead of Playwright's default disabling flag and succeeded. This is evidence of feasibility, **not proof that the flag was the sole cause or that delivery is now consistently reliable**. Preserve terminal 404/410 handling and bounded retry behavior in the real implementation.

This test does not prove visible OS notification presentation, native permission UX, notification-click behavior, Android installation, phone lock-screen delivery, iPhone delivery, or delivery with the entire browser force-stopped. Do not promise delivery under OS force-stop or restricted background conditions.

Reproduce from the repository root:

```powershell
npm install --prefix .local/phase1-push-probe --no-audit --no-fund --ignore-scripts web-push@3.6.7
node --import tsx scripts/probe-web-push.mjs
```

Requires installed Google Chrome and network access to npm and the browser push service. The temporary browser profile is separate from the user's normal profile. Failed or inconclusive delivery returns a nonzero exit status. This loopback URL is not a phone test link.

## Findings that affect implementation

| Finding                                                                                                      | Required treatment                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/sw.js` retires old offline caches and unregisters                                                    | Replace the retirement lifecycle with a notification worker; retain narrowly scoped old-cache cleanup. Do not introduce project/news offline caching. Update `RetireOffline` and retirement tests together. |
| CSP already allows same-origin workers and connections                                                       | Keep those restrictions. The proof registered and handled push under the existing policy; no broad third-party script or connection permission is needed for the UI.                                        |
| Legacy guest, push-subscription and push-job tables remain, but active implementation is absent              | Preserve historical data. Use additive new notification structures with explicit fresh opt-in; do not reactivate old subscriptions or queued jobs.                                                          |
| Legacy push jobs support projects/revisions only                                                             | They do not represent category/community follows, news or inbox read state. Do not simply restart an old worker.                                                                                            |
| Project and news approvals already run in database transactions                                              | Insert publication events inside those same transactions; dispatch only after commit. Rejected/draft/rolled-back edits must never become alerts.                                                            |
| `check-deployment.ts` rejects `ENABLE_BROWSER_PUSH`; Compose has no push runtime configuration or dispatcher | Update validation, runtime mapping, dispatcher service and release checks together. `coolify-deploy.mjs` currently rejects extra services, so adding a worker requires a deliberate validator change.       |
| Build script blanks VAPID values to avoid importing local secrets                                            | Keep secrets out of builds. Serve only the public key through runtime configuration instead of baking it into a `NEXT_PUBLIC_*` build value.                                                                |
| No VAPID keys found in the two local environment files                                                       | Generate durable production keys later and configure them securely. This observation does not establish what secrets are currently stored in Coolify.                                                       |
| Current privacy text covers favourites, but not new notification subscriptions                               | Add the new device/follow/push storage, purposes, retention and deletion controls with implementation. Respect existing unrelated privacy edits.                                                            |

## Recommended Phase 2 design

1. **Device identity and preferences:** create a random, revocable browser/installation identity after an explicit follow or settings action. Store only a hash of its bearer token server-side; use a secure HttpOnly same-site cookie for requests. No fingerprinting or public account. Support deleting all notification preferences and data for this device.
2. **Subscriptions:** bind follows and push credentials to that device identity, not an identifier supplied without proof. Follows and inbox access must work without push permission. Separate news consent from category/community/project follows. Validate origins, request size, subscription shape and supported HTTPS push endpoints; reject private-network destinations and redirects to avoid turning dispatch into arbitrary outbound requests. Redact subscription credentials from logs.
3. **Publication events:** persist one event per approved revision (including news revisions) with a stable deduplication key. Compare the previous approved project version to identify first publication or status change. Other substantial edits use the proposed reviewer-visible major-update flag. Ordinary corrections do not alert. Do not send historical backlog on deployment or first follow.
4. **Inbox:** use public publication events for All updates and follow-matched events for For you, with bounded history and device-specific read state. Recheck current public visibility when returning events. Agree explicit retention constants in implementation and document them.
5. **Delivery outbox:** fan out committed events into durable per-device jobs with unique event/device keys so overlapping follows do not duplicate alerts. Use a dedicated bounded dispatcher with claim leases, retries/backoff for transient failures, expiration handling for 404/410, and recoverable restarts. Recheck follows, opt-out and publication visibility before dispatch. End-to-end exactly-once phone display cannot be guaranteed; stable notification tags limit duplicates after uncertain network outcomes.
6. **Withdrawal:** cancel pending deliveries and hide unavailable content from inbox results. An already delivered OS notification cannot reliably be recalled; its link must resolve safely if content has since been withdrawn.
7. **Deployment:** introduce validated runtime VAPID settings and a feature switch, the dispatcher service, additive migrations, dispatcher observability and safe disable behavior. Keep inbox and browsing available if phone delivery is unavailable. No paid notification vendor is required by this architecture, but production-server outbound connectivity still needs checking.

## Remaining checks and ownership

| Item                                                            | Status / next action                                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Production-origin installation on Android                       | User has an Android phone available. Test from Chrome on the live origin; record OS/browser version and results.                               |
| Android push while tracker is closed, notification tap, opt-out | Pending a restricted production-origin test surface or the feature candidate. The isolated desktop experiment is not a public phone test link. |
| iPhone home-screen installation and push                        | No iPhone tester confirmed. Keep this as an explicit acceptance gap.                                                                           |
| Actual permission prompts and declined/blocked recovery         | Pending UI implementation and device testing.                                                                                                  |
| Production VAPID configuration and outbound push access         | Not yet inspected/configured in Coolify. No production secret or service change was made.                                                      |
| Deployed dispatcher/migrations and restart recovery             | Phase 2 and release verification work.                                                                                                         |
| Durable notification records, inbox, retries and preference UI  | Not implemented in this phase.                                                                                                                 |

Friday remains a conditional target. The website has the installation prerequisites and Web Push is technically viable without an APK. The remaining critical path is integrating durable notifications and verifying the deployed candidate on the Android phone. iPhone readiness must not be claimed without its own device result.

## Scope preservation

Existing uncommitted backup, monitoring, deployment, readiness and privacy work was present at the start and left intact. Phase 1 adds this document and the isolated probe only. It does not alter application source, package manifests, the database schema, live subscribers, production configuration or deployment.

## Primary references

- Installed Next.js guide read before writing the probe: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.
- [Web Push library](https://github.com/web-push-libs/web-push): VAPID, subscription credentials, encrypted delivery and response handling.
- [WebKit: Web Push for iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): iOS/iPadOS 16.4+ home-screen web apps, explicit user interaction for permission, and Apple push service connectivity.
