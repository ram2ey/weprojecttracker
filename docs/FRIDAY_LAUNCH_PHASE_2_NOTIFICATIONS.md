# Friday launch — Phase 2 notification foundation

Implemented locally on 12 November 2026. No production deployment, production migration, secret changes or messages to existing subscribers were performed.

## Delivered

- Device-scoped project, category, community and news follows without public accounts.
- Private inbox/read-state API plus a public All updates feed.
- Publication events committed atomically with independent staff approval. New projects and status changes notify automatically. Other project updates require the approving request's `notifyFollowers: true`. New news publications notify news subscribers; subsequent news corrections stay quiet unless the approver explicitly sets that flag.
- Durable inbox receipts and phone-delivery jobs, deduplicated per event/device even when follows overlap.
- Retry/backoff, lease recovery, subscription expiry handling, opt-out, device deletion and withdrawal cancellation.
- Encrypted push subscription credentials, restricted outbound endpoints with socket-time public-address checks, request limits and same-origin mutation checks.
- A notification-only service worker and a separate dispatcher service with health checks.
- Additive migration `0011_notification_foundation`; historical guest/push data and jobs remain inactive.
- Runtime deployment configuration, CI integration tests and privacy disclosures.

The new public buttons, Updates screen, panels and browser registration/permission UI belong to Phase 3. Existing navigation does not register the new worker automatically. The `notifyFollowers` fields are accepted by staff APIs; their reviewer controls also belong to Phase 3.

## Data and lifecycle

| Table                       | Purpose                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `notification_device`       | Random device identity, hashed bearer token and fixed 180-day expiry                             |
| `notification_follow`       | Up to 100 explicit follows per device; original follow timestamp                                 |
| `notification_subscription` | One encrypted push subscription per device; unique endpoint hash and generation                  |
| `notification_event`        | Approved public update, subject, topic IDs, publication dedupe key and fanout marker             |
| `notification_receipt`      | Per-device inbox/read state and durable delivery state, lease, attempt count and provider status |

The HttpOnly, SameSite=Strict `wassa_notifications` cookie is created only after a successful explicit follow. It is Secure on HTTPS and expires after 180 days. No cookie is created by reading the feed. Expired devices, follows, credentials and receipts are removed by dispatcher cleanup. Events and their receipts expire after 90 days. Backup retention is separate.

No historical events or subscriptions are imported. Fanout only matches follows that existed when the event was published. Phone jobs additionally require a push subscription that existed then. Later opt-ins do not replay old phone alerts. The All updates feed can show retained public history; For you contains matched receipts from the device's follows. Read state belongs to those personalised receipts; All updates does not silently subscribe a visitor.

Unfollowing keeps updates that still match another follow. Unsubscribing from phone delivery preserves follows and inbox state. Deleting notification data deletes the device and cascades through its private notification records. Clearing browser storage alone does not send this deletion request; remaining server records expire normally.

## API contract for Phase 3

Endpoint: `/api/public/notifications`. Responses are private/no-store. Mutation requests require the exact application Origin. POST requires JSON and is limited to 16 KiB. Bodies are strict: extra fields are rejected. No endpoint returns subscription credentials, bearer tokens or private keys.

| Request                                                                                 | Behavior                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET ?view=for-you&page=1`                                                              | Follows, subscription/device flags, unread count, matching items, pagination and public push configuration                                        |
| `GET ?view=all&page=1`                                                                  | Currently visible approved events; does not create an identity                                                                                    |
| `POST {"action":"follow","follow":{"kind":"category","target":"category-education"}}`   | Validate the target, create a device if needed, add an idempotent follow                                                                          |
| `POST {"action":"unfollow","follow":{"kind":"category","target":"category-education"}}` | Remove that follow and cancel jobs that no longer match any follow                                                                                |
| `POST {"action":"subscribe","subscription":{...}}`                                      | Save the browser's `PushSubscription.toJSON()` after explicit permission; requires an existing device/follow and valid enabled push configuration |
| `POST {"action":"unsubscribe"}`                                                         | Remove the subscription and cancel queued/in-flight job claims for that device                                                                    |
| `POST {"action":"read","ids":["EVENT_UUID"]}`                                           | Mark up to 50 owned receipts read                                                                                                                 |
| `POST {"action":"read","before":"2026-11-12T06:00:00.000Z"}`                            | Mark owned receipts through that timestamp read; server clamps future timestamps to now                                                           |
| `DELETE`                                                                                | Delete this device's notification data and expire its cookie                                                                                      |

Follow kinds are `project`, `category`, `community`, `news`. Targets are the corresponding record/taxonomy IDs; news uses `all`. Project follows require a currently published project, community follows an active community, and categories one of the fixed five IDs. News is independent of category/community follows.

Pages contain at most 50 events. Invalid input returns 400, missing device access 401, wrong origin 403, missing target 404, subscription ownership conflict 409, wrong content type 415, throttling 429 and temporary unavailability 503. Shared-network limits currently allow 240 reads or 120 writes per minute per network-address bucket. Existing trusted-proxy address hashing is reused; no raw address is added to notification records.

`push` is either `{enabled:false}` or `{enabled:true,publicKey:"..."}`. Private keys and the encryption key are runtime-only. Misconfigured push reports unavailable to visitors while inbox access remains available.

After an explicit phone-alert choice, Phase 3 should register `/notification-sw.js` with scope `/` and `updateViaCache: "none"`, obtain browser permission/subscription, and POST that subscription. Register only this new script for new subscriptions. The old `/sw.js` retirement path remains for previous installations; the existing retirement component only updates that old script URL and leaves the new worker alone.

The new worker clears only old `wassa-public-*` caches, handles notifications and same-origin project/news navigation, and has no fetch handler or offline content cache. It uses stable event tags to replace duplicate displays. Permission prompts, installed-app detection and Android/iPhone instructions remain Phase 3/4 work.

## Delivery behavior

- A dispatcher transaction locks up to 25 unprocessed events with `SKIP LOCKED`, creates at most one receipt per event/device, and marks fanout complete in the same transaction.
- Each delivery is claimed with a unique token and a 60-second lease. A worker crash leaves the job reclaimable; stale claims cannot complete a newer claim.
- The dispatcher rechecks public visibility, retirement, device expiry, current follows and subscription generation before sending. Jobs expire after 24 hours and make at most six send attempts. Network requests have a 10-second total timeout.
- Successful provider responses mark sent. HTTP 404/410 removes only the matching subscription generation and cancels its outstanding jobs. An old in-flight failure cannot remove a newer subscription.
- Network failures, 408, 429 and 5xx retry with exponential delay and bounded Retry-After handling. Other errors fail the job. Provider response bodies and credentials are not logged.
- Five delivery attempts per batch bound work time. Poll interval is five seconds. Count-only logs include fanout, attempts, outcomes and push mode.
- Disabled or invalid push still creates inbox receipts. It cancels outstanding phone claims, avoiding a delayed phone backlog when delivery is restored. Invalid configuration makes worker health fail so deployment/operations can detect it.
- Withdrawal retires related events and cancels pending claims; inbox queries independently recheck visibility. Previously delivered OS notifications cannot be recalled reliably. A notification already being transmitted can still arrive after opt-out/withdrawal; its destination must handle unavailable content safely.
- Delivery is at-least-once under uncertain network outcomes, not exactly-once. Stable browser tags reduce visible duplicates; OS behavior and force-stop/background restrictions still apply.

## Deployment preparation

1. Build the web and tools images from the same release. Apply migration `0011_notification_foundation` using the existing migration job before starting the matching web/dispatcher version. The migration only creates five new tables and their constraints/indexes.
2. Update the saved Coolify Compose to the reviewed repository definition, including the new `notifications` service. The deployment validator now requires that service; older saved Compose must be updated instead of merely changing image tags.
3. The worker uses the tools image, no published port or data volume, bounded resources, database health and migration-success dependencies. It runs `node --import tsx scripts/notification-worker.ts`. The Coolify release check now waits for web, database and notification-worker health.
4. Leave `ENABLE_BROWSER_PUSH=false` initially. The dispatcher can build inboxes without any VAPID/encryption keys. When preparing real phone verification, supply the settings below consistently to web and worker via private runtime configuration.
5. Verify worker health, API behavior and device permission flow on the deployed candidate before calling phone notifications ready. Only then expose the Phase 3 controls with their working behavior.

| Runtime setting               | Requirement                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `ENABLE_BROWSER_PUSH`         | `false` by default; `true` only with complete valid configuration |
| `VAPID_PUBLIC_KEY`            | Stable unpadded base64url P-256 public key, 65 bytes              |
| `VAPID_PRIVATE_KEY`           | Matching private key, 32 bytes; secret                            |
| `VAPID_SUBJECT`               | Publisher-controlled HTTPS contact URL or mailto address          |
| `NOTIFICATION_ENCRYPTION_KEY` | Independent random 32-byte base64url key; secret and stable       |

Generate/store production keys securely; none were generated or installed by this phase. Key material must never enter Git, screenshots, logs or public build variables. Keep the encryption key stable while subscriptions exist; rotating it requires an explicit re-encryption or fresh-subscription procedure. VAPID rotation similarly requires browser re-subscription planning. Build-time secret isolation remains in place.

For local development, supply the development environment explicitly to the worker; it does not auto-load production or local environment files. `compose.yaml` provides an opt-in `notifications` profile; run the tools migration before starting it. Coolify Compose has the dependency gate automatically.

Worker health: `node --import tsx scripts/notification-worker.ts --health`. It checks a heartbeat younger than five minutes and rejects invalid push configuration. Tests can isolate this file through `NOTIFICATION_HEALTH_FILE`; production uses the container's temporary directory. `--once` runs one batch and exits nonzero on a batch/configuration failure.

To disable delivery, set `ENABLE_BROWSER_PUSH=false` on both web and dispatcher and restart the matching services. Inbox operation continues. Do not drop notification tables or restore old queued legacy jobs. An application rollback may leave additive tables intact; stop this dispatcher if rolling back to an older application that does not understand its events.

## Verification record

- 41 unit/deployment tests passed, including push endpoint restrictions, encrypted credential ownership, expiry/retry policy and worker deployment isolation/health gating.
- 14 notification integration checks passed in a freshly created disposable PostgreSQL database. Coverage includes independent approvals, no draft/rollback events, quiet corrections, topic deduplication, concurrent claims, lease recovery, late 410 after re-subscription, no backlog, inbox-only behavior, opt-out, withdrawal, news opt-in, request guards, disabled/misconfigured push, worker command/health and retention.
- Legacy-to-current migration rehearsal passed, preserving hashes/history/legacy tables/media and supporting repeat migration.
- TypeScript and targeted lint checks passed; a production build and local production smoke checks passed. The earlier `.next-build` output hit a Windows Turbopack subprocess failure; a fresh `.next-phase2-build` output compiled successfully.
- Real push proof at **2026-11-12 06:16:12 UTC** used the implemented `sendPush` transport and actual `public/notification-sw.js` handler in a disposable desktop Chrome profile. Provider returned HTTP 201; notification display completed after the app page closed; unsubscribe and worker cleanup passed. Run `node --import tsx scripts/probe-web-push.mjs --foundation`. Sanitized evidence is in ignored `.local/phase2-push-probe/results-2026-11-12T06-16-12-345Z.json`.
- All 117 browser acceptance checks passed across 360px and 430px mobile layouts and desktop (6.3 minutes), including existing publication, moderation, accessibility, favourites and installation flows.

The real push experiment uses test-only credentials/subscriptions, no application database and no existing recipients. Desktop headless permission is pre-granted; it does not prove the phone permission UI, visible OS notification presentation, Android installation/background delivery, notification taps or iPhone behavior. The user has an Android phone available; those checks remain Phase 4/release gates. No iPhone tester is confirmed.

## Remaining phases

Use the [Friday launch checklist](FRIDAY_LAUNCH_CHECKLIST.md) as the working record of outstanding tasks, completion criteria, device checks and release evidence. Update its checkboxes as work is verified.

Phase 3 wires this foundation to the agreed category cards, follow buttons, bell/Updates screen, read controls, phone permission panels, reset/unsubscribe controls and reviewer major-update options. Phase 4 verifies the complete installed experience on phones. Production push keys, outbound network verification and deployment remain outstanding. Optional APK work is still secondary to those release requirements.
