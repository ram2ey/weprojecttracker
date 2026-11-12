# Friday launch — remaining work checklist

Updated: 12 November 2026. Target: Friday, 13 November 2026, subject to the release checks below.

This is the working checklist for the launch discussed with the user. It is separate from the older web-delivery, backup and Play-submission plans. Use this file to track remaining work; use the phase reports for technical evidence.

## Current status and how to use this file

| Area                                   | Status                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: feasibility                   | Completed; real desktop push demonstrated. Physical-phone checks remain open.                                                            |
| Phase 2: notification foundation       | Implemented and verified locally; not deployed.                                                                                          |
| Phase 3: public and reviewer interface | Mostly implemented and verified locally (12 Nov); scope changed to notifications by default. Unchecked items below remain. Not deployed. |
| Release candidate preparation          | Pending production configuration, migration and deployment.                                                                              |
| Phase 4: device acceptance             | Pending; user has an Android phone. No iPhone tester confirmed.                                                                          |
| Public launch                          | Pending release gates.                                                                                                                   |
| Downloadable APK                       | Optional; must not delay the required website experience.                                                                                |

An unchecked box means work or verification is still outstanding. Check a box only when its stated behavior is implemented or its check has passed. Record the date, tested release and evidence when completing a section. Local implementation does not mean deployed or phone-tested. If an item is deferred, record that decision explicitly instead of checking it off.

Implementation, automated checks and deployment preparation belong to the coding agent. The user supplies hands-on Android results when a test link and instructions are ready. Any unresolved design preference should be asked through the requested popup questions; the choices already agreed below do not need reconfirmation.

## Phase 3 — interface and complete user flows

### 3.1 Homepage categories

- [x] Replace community browsing directly below the landing-page hero with five visual category cards: Education, Health, General, Community Development and Social Amenities. (The user chose to remove the community list entirely; communities remain in the Projects filter.)
- [x] Show the current published-project count on each card; drafts and withdrawn projects must not contribute to the count.
- [x] Make each card open project results filtered to that category, with the selected category visible and a clear way to reset it.
- [x] Preserve community and status filters in project results and verify that they combine correctly with category filtering.
- [x] Handle a category with no published projects using a useful empty state and a route back to all projects.

Done when: all five cards lead to the correct results and counts, on mobile and desktop.

### 3.2 Installation entry points and panels

- [x] Check and complete the agreed entry points: Install tracker in the header/menu and as the secondary hero action beside Explore projects. Reuse the existing installation implementation where it already meets these requirements.
- [x] Present installation help as a slide-up panel on mobile and a centred dialog on desktop.
- [x] Connect supported browsers to the native install prompt after the visitor chooses to install; handle dismissal without showing a false success state.
- [x] Show appropriate manual instructions where a native prompt is unavailable, including Android browser-menu and iPhone home-screen instructions.
- [x] Handle an already installed/standalone session without repeatedly inviting installation; retain a way to access help. (Hero action hidden; menu shows App help.)
- [x] Keep install wording accurate: website installation is available independently of Play Store availability; do not show an APK download until an actual release has passed verification.

Done when: every install entry point leads to working installation or applicable instructions, with no dead buttons.

### 3.3 Notifications by default (replaces Save/Follow buttons)

**Scope decision, 12 November 2026:** the user replaced per-item Follow buttons and the separate news opt-in with "everything by default". Reason given: research that extra opt-in steps reduce uptake. Browsers still require one tap and their own permission prompt before a website may send phone notifications; this was explained and accepted. Phone push cannot be enabled automatically.

- [x] The Updates feed and bell work for every visitor with no opt-in.
- [x] One tap ("Turn on notifications") requests permission, then follows all five categories plus news through the new `follow-all` API action and saves the push subscription. Every published project has a category, so this covers all project and news alerts.
- [x] Save (favourites) stays separate and never subscribes anyone. (Favourites code unchanged; its existing tests pass.)
- [ ] Settings let a device untick categories or news afterwards; changes show immediately, persist through the API and revert on failure. Untick, persistence and reload are tested; the failure/revert path is implemented but untested.
- [x] Explain that settings and read state belong to this browser/installation and do not sync between devices.

Done when: a visitor can turn everything on in one tap, adjust topics, and reload without losing state.

### 3.4 Bell and Updates page

- [x] Place the notification bell beside the top menu on mobile, with an accessible desktop equivalent; open a full Updates page.
- [x] Show an unread count on the bell with an accessible label ("Updates, 2 unread"). Read state is kept in this browser: a first visit starts with nothing unread, and opened or marked-read items are remembered. (With everything on by default, there is a single feed instead of For you / All updates.)
- [x] Use the public `view=all` feed; reading it never creates a device or cookie.
- [ ] Display the update title, type, date and a working project/news link; paginate the retained feed. Display and links are tested; "Show older updates" (more than 50 items) is implemented but untested.
- [x] Add individual read handling and Mark all as read; ensure the bell count and read states stay consistent after navigation and reload.
- [ ] Provide useful states for no updates, loading and request failure, including retry and a way to browse projects. The empty state has been checked visually; the failure/retry state is implemented but untested.
- [x] Handle content that becomes unavailable between viewing an update and opening its link. (The feed hides withdrawn content; a stale link reaches the existing tested not-found page.)
- [x] Link notification settings from the Updates page.

Done when: the bell, feed and read controls work together without requiring an account.

### 3.5 Phone permission and notification settings

- [x] Show a small, dismissible invitation shortly after the first visit, once the cookie banner has been answered. It must never open the browser's permission prompt by itself. Not now hides it for 30 days. (Replaces the earlier "after the first follow" trigger.)
- [x] Use a slide-up panel on mobile and a corner card on desktop, with Turn on notifications and Not now. Not now must leave the Updates feed working.
- [x] Request native permission only after the visitor taps Turn on notifications, register the new notification worker and save the resulting subscription through the API. (Browser tests substitute the permission prompt and PushManager; real worker registration and API.)
- [ ] Handle unsupported browsers, disabled server push, denied permission and temporary subscription errors with accurate guidance. Do not label alerts enabled until subscription saving succeeds. Denied permission is tested; the other cases are implemented but untested.
- [x] Provide a later Turn on notifications action in settings and on Updates, including browser-settings guidance when permission is blocked.
- [x] Show topics (categories and news) and phone-notification status; allow each topic to be unticked.
- [x] Provide Turn off notifications that removes the server subscription and cleans up the browser subscription while keeping topics and the feed.
- [x] Provide Delete notification data with a confirmation panel that explains the scope; remove device notification data and reconcile the browser subscription/UI. Keep saved favourites separate.
- [ ] Check returning visits and expired/cleared device state so the interface does not report a working subscription that the server no longer recognises.

Done when: enabling, declining, retrying, disabling and deleting notification preferences all produce accurate, recoverable states.

### 3.6 Staff publication controls

- [ ] Add a reviewer control for project updates using the existing `notifyFollowers` field. Per the 12 November scope decision it is **ticked by default**; reviewers untick it for minor corrections.
- [ ] Explain that first publication and project status changes generate alerts automatically, so reviewers understand which behavior is automatic.
- [ ] Add the equivalent explicit alert choice for subsequent news updates; new news publications already notify separately opted-in news followers.
- [ ] Verify the review interface submits the selected choice and that drafts, rejected revisions and ordinary corrections do not generate unintended alerts. The server rules are covered by integration tests; the three controls above are implemented, but the reviewer UI has no browser test yet.

Done when: reviewers can deliberately distinguish major updates from quiet corrections before approving publication.

### 3.7 Interface verification

- [ ] Check the new flows at 360px and 430px mobile widths and desktop, including long titles, large text and no horizontal overflow.
- [ ] Verify keyboard navigation, visible focus, control labels, dialog focus/close behavior and touch target sizes.
- [ ] Add focused browser coverage for category navigation, follow/save separation, inbox read state, permission outcomes, unsubscribe/delete and reviewer choices.
- [ ] Run relevant automated tests, type checking, lint, a production build and production smoke checks; record results for the completed Phase 3 release.
- [x] Recheck privacy/help wording against the final interface and actual retention/deletion behavior.

Evidence, 12 November 2026 (local, uncommitted working tree on `codex/nightly-backups`): typecheck and lint clean; 41/41 unit tests; 15/15 notification integration checks (including new one-tap `follow-all`); 123/123 browser acceptance checks at 360px, 430px and desktop (production build). The new tests cover categories, install entry points, the invitation, the bell, read state, turning notifications on and off, topics, deletion, denied permission, 200% text without horizontal overflow, and axe checks. The test server now runs with throwaway runtime push keys; no dispatcher runs, so nothing is sent.

Done when: the full interface passes its checks. Phase 2's earlier passing tests are a baseline, not proof of the new UI.

## Release candidate — make the completed flows available for phone testing

- [x] Prepare matching web and tools images containing the reviewed Phase 2 and Phase 3 changes; record the release identifier. (`sha-9cd212f…-43184904513-1`)
- [x] Generate and securely store stable production VAPID keys, contact subject and notification encryption key. Supply matching runtime settings to web and worker; keep secrets out of Git and build output. (12 Nov; see completion table)
- [x] Update the saved Coolify Compose definition to include the notifications worker and required health/dependency configuration. (The deploy uploads the reviewed Compose file; notifications service healthy.)
- [ ] Confirm the current database backup/recovery position before applying the additive notification migration; preserve existing historical tables and inactive legacy subscriptions. **Not met in order:** migration 0011 (additive only) was applied on 12 Nov before off-site backups existed; the first backup and a passing restore check followed the same day. Future migrations are covered by nightly backups.
- [x] Apply the migration with the deployment's migration job and confirm web, database and worker readiness. Start with phone push disabled while checking inbox operation.
- [ ] Verify server outbound push connectivity, runtime key validation, worker heartbeat and safe operational logs; enable push for the acceptance candidate when ready.
- [ ] Exercise approval-to-inbox-to-phone delivery with designated test recipients. Do not notify existing audiences merely to test the deployment.
- [ ] Check worker restart recovery, transient failure handling, expired subscription handling and the ability to disable phone delivery while keeping the inbox usable.
- [ ] Provide the user with the deployed HTTPS test link and a short Android test script for the checks below.

Done when: a named deployed candidate is healthy and can be tested end to end on the user's phone. This is separate from declaring the public launch ready.

## Phase 4 — physical-device acceptance

### 4.1 Android — required, user has a phone available

- [ ] Record phone model, Android version, browser/version, candidate release and test date.
- [ ] Install from the live website, launch from the home-screen icon and verify the correct name, icon, start page and standalone experience.
- [ ] Check category browsing, project details, Save, the bell and Updates on the actual device.
- [ ] Tap Turn on notifications in the invitation; accept the browser prompt; confirm an accurate enabled state.
- [ ] Trigger a new project, status change and approved update (alert box ticked); verify correct Updates entries and phone notifications without duplicates.
- [ ] Close the tracker page and verify background/lock-screen delivery under normal device conditions; record observed timing and any restrictions rather than promising delivery after OS force-stop.
- [ ] Tap a notification and verify it opens the correct project/news page, both with the tracker open and closed.
- [ ] Verify read state, unread count and follows after closing/reopening the same installation. Check browser versus installed-app behavior and document any preference separation.
- [ ] Choose Not now, deny permission and retry through settings; verify each path keeps the inbox usable and gives accurate recovery instructions.
- [ ] Verify unticking News in settings stops news alerts; verify an update approved with the alert box unticked does not trigger a phone alert.
- [ ] Untick a topic, turn off notifications and delete notification data in separate checks. Verify subsequent events respect each choice and the interface reflects it.
- [ ] Open an update whose content has been withdrawn and verify a safe unavailable-content page.

Done when: the user reports results for these checks, failures are resolved or explicitly scoped out, and the tested release is recorded here.

### 4.2 iPhone — acceptance gap until a tester is available

- [ ] Confirm access to an iPhone tester and record device/browser/OS details. **12 Nov 2026:** the user reports having tested on an iPhone; device, iOS version and which checks below passed are still to be recorded.
- [ ] Verify home-screen installation, permission from the installed app, background notification display, notification taps and opt-out.
- [ ] If no tester is available before launch, document iPhone notification support as unverified and avoid claiming it has passed acceptance. Record the launch scope decision explicitly.

## Public-launch gate

- [ ] Phase 3 interface checks and required Android acceptance have passed on the candidate intended for launch.
- [ ] Production migration, worker health, keys, outbound delivery and operational disable procedure are verified.
- [ ] Confirm homepage counts, navigation, install entry points, Updates, settings, privacy and unavailable-content handling on the deployed release.
- [ ] Record any remaining limitations, including the iPhone acceptance gap or deferred APK, alongside an explicit launch decision.
- [ ] After release, verify homepage/API health and one designated test subscription's complete delivery flow; check worker errors and pending delivery behavior.
- [ ] Update this checklist with completion dates, the deployed release and evidence links. Keep unfinished items unchecked.

## Optional — downloadable Android APK

Website installation and the notification flow take priority. These boxes are not prerequisites for the website launch unless the user changes the agreed scope. Play Store submission/testing continues as a separate track; distributing an APK does not complete that track.

- [ ] Select and document the packaging approach and application identity, including whether it needs verified website association.
- [ ] Produce a release-signed APK and securely retain the signing key for future updates.
- [ ] Configure and verify any required website association against the release signing certificate.
- [ ] Test installation from the website, app launch, navigation, notifications, uninstall and an update using the same signing identity on a real Android phone.
- [ ] Publish a versioned download only after verification, with file size, version, integrity checksum, installation guidance and clear update expectations.
- [ ] Add the verified download to the installation panel while keeping website installation available; do not imply Play Store approval.

## Completion evidence and references

Add one row as each remaining stage is completed. Do not place credentials or subscription endpoints in this record.

| Stage                              | Completion date                        | Release/commit                     | Evidence or unresolved items                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3 interface                  | 12 Nov 2026 (partial)                  | `9cd212f` (PR #26)                 | Local and CI checks passed; open items listed in §3.4–3.7                                                                                                                                                                                                                                                                                                                          |
| Deployed candidate                 | 12 Nov 2026, push **off**              | `sha-9cd212f…-43184904513-1`       | Release run 43184904513 green; `/api/ready` migrated=true (0011 applied), backup=none; live read-only Chrome checks pass at 360px and desktop (one intermittent first-load failure, then 4/4 passes). Still to do: production keys, enable push, Android test, backups                                                                                                             |
| Off-site backups                   | 12 Nov 2026                            | `sha-9cd212f…-43184904513-1`       | Cloudflare R2 bucket `wassa-east-backups`, bucket-scoped account token; first snapshot `f6bfe78c` (20 media files); restore check with throwaway database passed (row counts matched); `/api/ready` backup=ok. Recovery password in Coolify and the password manager. GitHub variable `REQUIRE_BACKUP=true` set, so the uptime monitor fails without a backup in the last 36 hours |
| Push enabled                       | 12 Nov 2026                            | `sha-9cd212f…-43184904513-1`       | Production VAPID pair and notification encryption key generated locally, stored in Coolify secrets and the password manager (never displayed); `ENABLE_BROWSER_PUSH=true`; `/api/public/notifications` reports push enabled with the new public key; service worker served; `/api/ready` ready, backup=ok                                                                          |
| Android acceptance                 | Pending                                | —                                  | —                                                                                                                                                                                                                                                                                                                                                                                  |
| iPhone acceptance / scope decision | Pending                                | —                                  | —                                                                                                                                                                                                                                                                                                                                                                                  |
| Public launch                      | Pending                                | —                                  | —                                                                                                                                                                                                                                                                                                                                                                                  |
| Single Admin role (scope change)   | 12 Nov 2026 (PR #27, not yet deployed) | migration `0012_single_admin_role` | User decision: one Admin role with every permission; admins may publish their own work. Existing editor/approver accounts converted and audited; About/FAQ no longer promise a separate approver. Integration (15/15), migration rehearsal and browser tests updated and passing                                                                                                   |
| Lighter pages and news previews    | 12 Nov 2026 (PR #27, not yet deployed) | —                                  | News photos served from `/api/public/news/<id>/photo` with year-long caching instead of being embedded twice per page; news link previews use the story photo. Optional APK deferred by the user                                                                                                                                                                                   |
| Optional APK                       | Deferred                               | —                                  | —                                                                                                                                                                                                                                                                                                                                                                                  |

- [Phase 1: agreed experience and feasibility](FRIDAY_LAUNCH_PHASE_1_FEASIBILITY.md)
- [Phase 2: implementation, API contract, deployment details and verification](FRIDAY_LAUNCH_PHASE_2_NOTIFICATIONS.md)
