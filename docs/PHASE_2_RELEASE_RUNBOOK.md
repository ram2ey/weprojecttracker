# Phase 2 release and recovery runbook

Prepared 6 November 2026. This is the Google Play infrastructure work, separate from the historical October feature phases. Production release remains Phase 4. The draft PR must not be merged merely to activate CI.

## Ownership and current limits

The office's IT administrator owns deployment and incident triage. On 6 November the user selected GitHub Actions failure notifications to their own GitHub account. Project Personnel prepare records; the Project Lead independently approves them. Confirm the account's Actions notification preferences before relying on delivery; no notification email or third-party messaging service was added.

Backblaze B2 setup and restore testing are explicitly deferred by the user. No recoverable backup is known. The migration rehearsal below uses synthetic fixtures, not a restored production backup. It does not close the backup/restore gate. Recovery-point/time targets remain proposals in [the recovery plan](PHASE_2_BACKUP_AND_RECOVERY_PLAN.md).

## Release configuration

Use the existing Coolify **service** `pnj4g33ejfgwgpgqkqbeol3v`, not the separate Cloudflare connector. Do not create a replacement resource or rename its volumes:

| Logical mount | Existing backing volume           | Destination              |
| ------------- | --------------------------------- | ------------------------ |
| postgres      | pnj4g33ejfgwgpgqkqbeol3v_postgres | /var/lib/postgresql/data |
| media         | pnj4g33ejfgwgpgqkqbeol3v_media    | /data/media              |

The prepared [demo Compose](../compose.coolify-demo.yaml) retains the existing loopback port `127.0.0.1:33187:3000`, allowing the separate Cloudflare connector to remain usable during cutover. It has only database, migrate and web; it preserves the logical mounts, private database, non-root web/tools identities, bounded logs and migration dependency. The [final-domain Compose](../compose.coolify.yaml) omits the loopback port. Use the demo variant until the permanent domain is verified, then deliberately remove that port and retire/redirect the demo path. Never use `down -v`, volume prune, or host-wide cleanup on this shared server.

Required Coolify values: `APP_URL`, paired `WEB_IMAGE`/`TOOLS_IMAGE`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`. Preserve the existing database password and auth secret; changing the environment variable does not change the database's stored password. No Google, MFA, maps, push or render-cache runtime credentials are required by the reduced app. Preserve legacy encryption keys in existing secure maintenance records before removing their runtime references.

`RELEASE_ID` is baked into both images by the workflow as `sha-COMMIT-RUN-ATTEMPT`. Do not override it in Coolify. The tools command writes a `deployment.migrated` audit marker only after all migrations succeed. Web readiness requires its own release's marker. Local controlled production builds using `compose.yaml` must explicitly set the same valid `RELEASE_ID` build argument for both targets.

The current live pair, retained for reference:

```text
ghcr.io/ram2ey/weprojecttracker-web:sha-39819897731b70f09ea91452f5d305aa6fa7fbd0-42191949662-1
ghcr.io/ram2ey/weprojecttracker-tools:sha-39819897731b70f09ea91452f5d305aa6fa7fbd0-42191949662-1
```

These old images require the old Compose/runtime and are not an automatic rollback target after account conversion. Record the eventual candidate pair and registry digests from its workflow summary before release.

## Domain and TLS cutover

The approved origin is `https://wassaeastprojecttracker.com`; `www` redirects to the apex. DNS is managed at Nakroteck. Domain routing, website A records, the existing app's `APP_URL` and trusted certificates were verified on 7 November against server `46.62.214.164`. See [domain verification](PHASE_2_DOMAIN_VERIFICATION_2026-11-07.md). Mail records and shared proxy settings are preserved. The procedure below remains the reference for future changes and the reduced-app release.

1. Read the target server's actual public address from Coolify and check its proxy health and ports 80/443. Do not infer an address from the demo tunnel. Preserve mail MX/TXT/DKIM records, nameservers and domain ownership records.
2. In the same service, configure web for `https://wassaeastprojecttracker.com:3000` and `https://www.wassaeastprojecttracker.com:3000` through the Coolify proxy. The external origin has no port. Verify Coolify's generated routing and the actual apex redirect choice; do not blindly save pre-existing unsaved forms.
3. Replace only the parking website records with the verified server A record at `@` and a `www` A record to the same server. Add and verify replacements before removing obsolete records. The HTTP proxy supplies the www→apex redirect; a DNS alias alone would not redirect a browser. Do not change mail records or add an unverified IPv6 address.
4. During the coordinated Phase 4 release, use `APP_URL=https://wassaeastprojecttracker.com` and the reviewed matching Compose/image pair. Check certificates for both names, HTTP→HTTPS, www→apex with path/query preservation, canonical/social/sitemap origins and absence of mixed content.
5. Verify sign-in/password change/logout over the proxy, secure session cookies, origin rejection and trusted client-IP/rate-limit behavior. Preserve the Cloudflare connector until these checks pass.

## CI and deployment gates

The release workflow validates pull requests and manual review-branch runs without publishing/deploying. On main it validates, then publishes the matching images and deploys automatically. Required checks should be `checks`, `acceptance`, `container-rollout`, `images (web)` and `images (tools)`. Require a PR, current checks, resolved conversations, no force pushes/deletions and no administrator bypass. No extra approving reviewer is required for the current single-maintainer repository; independent editorial approval remains mandatory in the app.

Acceptance uses a disposable PostgreSQL 16 instance on loopback port 55432, explicit `TEST_DATABASE_URL`, test-only secrets and Chromium. It never loads local environment files in CI. Failed browser traces/reports contain synthetic fixtures only and expire after seven days.

The synthetic rehearsal creates a uniquely named database, applies the real migration chain through 0003, seeds legacy accounts/history/financial fields/media metadata and bytes, then applies 0004–0006 twice. It verifies deterministic unique usernames, unchanged password hashes and all legacy rows/files, session invalidation, temporary expiry, access-version defaults and maintenance operator recovery. It cleans only its own generated database/files. It is not a production restore test.

The disposable container rehearsal builds both Linux targets, deliberately fails migration and verifies web does not start, then uses fresh CI-only volumes for a successful migration/startup. It checks exact release readiness, retained-route behavior, private staff access and non-root media writes. It never runs on the shared Coolify host.

Before updating image references, the deploy script validates the saved Compose's services, image variables, private database, migration dependency and retained mounts. It then updates just the two image variables, requests rollout and waits for healthy web/database plus the expected migrated release. An old healthy container, migration failure, permission failure or timeout fails the job. Full public smoke covers the register, About, login, sitemap/robots, query-preserving redirect, retired routes and private staff boundary. If published records exist it also checks one project and photograph. An empty register produces no false claim of project/media coverage; final-host workflow checks remain Phase 4.

Release correction — 7 November 2026: Coolify v4.5.3 withholds `docker_compose_raw` from the existing deploy/read/write token, so the first main release stopped before image changes. The workflow now sets `COOLIFY_COMPOSE_FILE=compose.coolify-demo.yaml`: the script validates that reviewed repository definition and applies it through the service update API (base64, `instant_deploy=false`) before updating paired images. Existing secrets/domains are omitted from the update, and exact volume/migration safeguards still apply. Only the two checked-in Coolify Compose filenames are accepted. This preserves the loopback connector and avoids granting sensitive-read access. Without this explicit option, inspecting a saved definition still fails closed if Coolify withholds it.

GitHub variables: `COOLIFY_URL=https://app.coolify.io`, `COOLIFY_RESOURCE_TYPE=service`, the existing resource UUID, and `PUBLIC_APP_URL=https://wassaeastprojecttracker.com`. Repository secret: existing `COOLIFY_TOKEN`. It expires **6 December 2026**; rotate before expiry using the same authorized team/permissions and update the secret directly. Never print the token, saved Compose/environment responses, or maintenance temporary passwords in workflow logs.

## Controlled production transition

1. Complete/review content and policy work, assess the explicitly deferred recovery gap, record the candidate commit/pair, and obtain the actual release decision. No main merge or production deployment is included in the current engineering work.
2. Arrange a short staff maintenance window. Confirm trusted access to the existing tools container/operator recovery command before invalidating sessions. Save available database/media recovery copies if the release decision permits proceeding; do not represent an untested copy as a demonstrated restore.
3. Apply the reviewed saved Compose and matching images together on the existing resource. Preserve secrets, mounts and working connector. The old worker disappears with the new definition; never delete its stored data.
4. Verify migrations through 0006 and readiness for the exact release. If a migration fails, stop and inspect privately; do not force web past its dependency. Do not mark the release successful just because Coolify says “started.”
5. Privately run `npm run staff:accounts` in tools to identify the converted operator username. Existing hashes are preserved. Accounts needing a change have a 24-hour transition window. If needed run `npm run staff:accounts -- USERNAME` in a trusted interactive maintenance session, hand the generated temporary password privately to its owner, and complete password change. Do not run this reset as a public GitHub job.
6. Perform the final-host editorial/account/media/security checks in Phase 4. Withdraw any controlled verification record immediately after verification. Do not seed synthetic CI fixtures into production.
7. After final-host success and merge of the uptime workflow into the default branch, set `MONITOR_ENABLED=true` and run **Public uptime** manually. Its schedule checks readiness/home from GitHub approximately every 15 minutes. Schedules can be delayed or disabled by GitHub; this is basic monitoring, not an uptime guarantee. Confirm receipt of a deliberate failed manual check in an isolated test, then recovery. No deliberate outage on production is needed.

## Incident response and rollback

The IT administrator checks the failed Actions job, then the relevant Coolify service health and private logs. Public errors contain no credentials or project text. Check certificate/DNS, disk, database and migration state before restarting anything. Limit intervention to this resource.

If only application code failed and the schema is demonstrably compatible, restore both previously verified image references and matching Compose, then re-run readiness/public smoke for that older release. The hardened deploy command generates new candidate references; it is not a rollback command. Do not automatically restore the pre-reduction application after migrations 0004–0006, reverse migrations, overwrite the live database or delete media. Database recovery requires a separately reviewed consistent backup/restore procedure, which remains deferred and unproven.
