# Minimal register deployment

## Runtime

Use the existing Docker/Coolify setup with PostgreSQL, the web service and a one-shot migration tools service. The background worker is removed. Build immutable web/tools images on a compatible Linux builder, never by copying Windows node_modules. compose.coolify.yaml runs migrations before starting web; compose.yaml is the controlled local-build variant.

Required configuration: APP_URL (public HTTPS origin), WEB_IMAGE, TOOLS_IMAGE, POSTGRES_PASSWORD and BETTER_AUTH_SECRET. Generate independent database and authentication secrets of at least 32 characters. The web runtime receives PostgreSQL connection fields, BETTER_AUTH_URL and MEDIA_ROOT from Compose. Production sample/design routes do not exist. Google, MFA, Geoapify, VAPID and push credentials are not required.

Keep PostgreSQL private. Persist database and media volumes. Media must stay outside the public directory and be served through the app's access checks. Both Docker targets run without root privileges. /api/health checks liveness; /api/ready checks database connectivity.

## Automatic deployment from GitHub

`.github/workflows/container-images.yml` runs on pushes to `main`. It runs lint, type checking and unit tests, builds and publishes both Linux images on GitHub runners, updates only `WEB_IMAGE` and `TOOLS_IMAGE` in the selected Coolify resource, then requests a redeploy. A failed check or image build prevents deployment. Each release tag includes the commit, workflow run ID and attempt; reruns do not overwrite the previous release's images. Releases are serialized instead of cancelling an active deployment.

One-time connection setup:

1. Select the **app resource** in Coolify's Wassa East project tracker project. Use its resource UUID, not the project UUID, domain or another resource's UUID. For Docker Compose Empty the resource type is `service`; for a Git-based Docker Compose application it is `application`.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add the repository secret `COOLIFY_TOKEN` (a Coolify API token authorized to update environment variables and deploy this resource). Add repository variables `COOLIFY_URL` (the HTTPS dashboard origin without `/api/v1`), `COOLIFY_RESOURCE_UUID`, and `COOLIFY_RESOURCE_TYPE` (`service` or `application` from step 1). Keep tokens out of source control and chat.
3. Ensure this resource uses the current `compose.coolify.yaml`, with `WEB_IMAGE` and `TOOLS_IMAGE` variables, migrations and persistent database/media volumes. For an existing Docker Compose Empty resource, update its saved Compose definition once; pushing Git does not update that saved definition. Retain its domain, secrets and existing volumes. The temporary Cloudflare hostname does not need a separate deployment trigger.
4. Ensure the Coolify server can pull `ghcr.io/ram2ey/weprojecttracker-web` and `ghcr.io/ram2ey/weprojecttracker-tools`. Private packages require registry credentials on the server. Disable any separate deploy-on-push webhook on this app so it cannot race the image builds. Its API must be reachable from GitHub runners.
5. Commit and push the release workflow, script and app changes to `main`. Open **Actions → Release to Coolify** to follow the checks, builds and deployment. Missing connection settings fail clearly before image builds. Application deployments wait for Coolify's deployment status; service redeploys report API acceptance, so confirm container health in the Coolify dashboard after the first release.

Manual runs remain available: leave **publish** off to validate builds only, enable **publish** to publish images, and additionally enable **deploy** to redeploy from `main`. Other branches never deploy. Workflow summaries record the image references for rollback; restore both previous image references together and redeploy. Database migration rollback requires a compatible backup as described below.

The workflow uses Coolify's [bulk environment update API](https://coolify.io/docs/api/endpoints/services/update-envs-by-service-uuid) and [deployment API](https://coolify.io/docs/core/automation/deploy-webhooks). It does not create resources, alter domains or remove volumes. The connection and a live release must be verified on the target instance; local tests mock its API.

## Migration and account transition

Run all existing migrations, including additive 0004_minimal_register. It adds username and must_change_password, backfills deterministic unique usernames and deletes old sessions. Existing password hashes, MFA data, legacy content fields, unused tables, files and publication history remain stored; they are not exposed by the reduced public projection. Keep the preserved encryption keys in existing secure records if historical MFA data may ever be restored, although this runtime does not need them.

In a fresh database, run npm run staff:bootstrap -- operator "Platform operator" in the tools container. It creates only the first operator and prints a temporary password once. Share it privately; first sign-in forces a password change.

For an upgraded database, npm run staff:accounts lists assigned usernames. Existing passwords still work, followed by a forced password change. A trusted maintenance operator can run npm run staff:accounts -- OPERATOR_USERNAME to recover an existing operator account; its temporary password is printed once and sessions are revoked. Other staff are managed from the operator's Staff screen. Never send command output containing temporary passwords to public deployment logs.

Resetting a password forces a change and revokes existing sessions. Deactivation revokes access immediately; reactivation does not restore prior sessions. Staff creation exposes only editor/approver roles; operator creation remains a maintenance action. The last active operator cannot be deactivated.

Apply additive migration 0005_temporary_password_expiry before running the Phase 1 code. New and reset temporary passwords expire 24 hours after issuance. Sign-in, staff identity checks and the locked password-change transaction enforce the deadline; successful password changes clear it and revoke all sessions. The migration preserves hashes and gives existing accounts that still require a password change one 24-hour transition window. Accounts with permanent passwords are unaffected. Expired operator credentials use the maintenance reset command; other staff use an operator reset.

Also apply additive migration 0006_staff_access_version. It adds a default-zero counter, without changing credential hashes/content. Reset, password change and access changes increment it; sign-in compares the counter before credential verification and after session insertion. A stale sign-in is denied and removed before returning its cookie/token. This closes the race where a sign-in could finish after existing sessions had been revoked. Username sign-in bodies are limited to 16 KB; the installed Better Auth login rate limits remain in effect.

HTML is dynamically rendered with a per-request script/style nonce through Next.js Proxy. Do not cache complete nonce-bearing HTML at a CDN or reverse proxy. CSP restricts script/connect/font/form origins, blocks framing/objects and allows style attributes needed by Next Image/Radix. Media routes retain their separate sandbox policy. Final-host TLS, forwarded origin/IP handling, secure cookies and rate limits remain release checks; no browser-reported CSP violations should occur in normal browsing or staff operations.

## Publication and photographs

Images accept JPEG, PNG and WebP up to 10 MB and 40 megapixels. They are decoded, re-encoded as metadata-free WebP and resized using the existing 2000px full/640px thumbnail bounds. New PDFs and internal-financial uploads are rejected. Existing legacy documents remain privately stored.

Only photographs referenced by the current approved, non-withdrawn project revision are public. Historical images remain private to authorized staff. All new staff endpoints recheck active-account and password-change state. Responses for private content and media use no-store. Public pages read current database state without the old render-cache signature query.

## Offline retirement and removed URLs

Keep /sw.js available during the transition. It replaces the previous worker, deletes only cache names beginning wassa-public-, claims existing clients and unregisters itself. Public pages ask an existing app worker to update but never register a new offline worker. Retain this retirement endpoint until previously installed clients have had adequate time to reconnect. Previously downloaded copies cannot be recalled.

/projects redirects permanently to / with its query string. Project detail URLs remain stable. Retired pages, APIs, Google/email authentication paths and MFA/setup paths return 404. Remove old navigation links and external bookmarks where applicable.

## Release checks

Before production, verify the migration and representative data locally, run typecheck/lint/unit/acceptance tests, build the Linux images, then test real image upload, approval, withdrawal, password reset, deactivation and first-login password change on the configured hostname. Keep the previous images and a compatible database/media backup for rollback. This change does not build backup infrastructure or deploy anything remotely.

Local smoke commands: node scripts/build-production.mjs then node scripts/check-production.mjs. The production smoke script uses only the isolated local test database, never a live deployment. Real launch content, target Linux runtime, HTTPS, persistence and recovery remain production acceptance tasks.

Local output isolation: default development `.next`, acceptance `.next-test` (override `TEST_DIST_DIR`), production verification `.next-build` (override `NEXT_DIST_DIR` on both smoke commands). Overrides must be simple project-local `.next-<name>` directories. A running preview must have its own directory; never rebuild it in place. The port-3002 preview's `.next-ci` output is preserved. Unsaved editor warnings are best-effort browser navigation guards, not crash recovery or durable local storage; save drafts before maintenance.
