# Automatic deployment from GitHub

`.github/workflows/container-images.yml` runs on pushes to `main`. It validates pull requests and main releases with lint, type checking, unit tests, isolated browser acceptance, a legacy migration rehearsal and a Linux container rollout test. It then builds and publishes both Linux images on GitHub runners, updates only `WEB_IMAGE` and `TOOLS_IMAGE` in the selected Coolify resource, then requests a redeploy. A failed check or image build prevents deployment. Each release tag includes the commit, workflow run ID and attempt; reruns do not overwrite the previous release's images. Releases are serialized instead of cancelling an active deployment.

One-time connection setup:

1. Select the **app resource** in Coolify's Wassa East project tracker project. Use its resource UUID, not the project UUID, domain or another resource's UUID. For Docker Compose Empty the resource type is `service`; for a Git-based Docker Compose application it is `application`.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add the repository secret `COOLIFY_TOKEN` (a Coolify API token authorized to update environment variables and deploy this resource). Add repository variables `COOLIFY_URL` (the HTTPS dashboard origin without `/api/v1`), `COOLIFY_RESOURCE_UUID`, `COOLIFY_RESOURCE_TYPE` (`service` or `application` from step 1), and `PUBLIC_APP_URL` (the final public HTTPS origin). Keep tokens out of source control and chat.
3. Ensure this resource uses the current `compose.coolify.yaml`, with `WEB_IMAGE` and `TOOLS_IMAGE` variables, migrations and persistent database/media volumes. For an existing Docker Compose Empty resource, update its saved Compose definition once; pushing Git does not update that saved definition. Retain its domain, secrets and existing volumes. The temporary Cloudflare hostname does not need a separate deployment trigger.
4. Ensure the Coolify server can pull `ghcr.io/ram2ey/weprojecttracker-web` and `ghcr.io/ram2ey/weprojecttracker-tools`. Private packages require registry credentials on the server. Disable any separate deploy-on-push webhook on this app so it cannot race the image builds. Its API must be reachable from GitHub runners.
5. Commit and push the release workflow, script and app changes to `main`. Open **Actions → Release to Coolify** to follow the checks, builds and deployment. Missing connection settings fail clearly before image builds. Application deployments wait for Coolify's deployment status. Service releases validate the saved Compose before mutation, then wait for healthy replacement containers, the expected release identifier and its successful migration marker. Both paths finish with public-route smoke checks. A healthy previous container cannot satisfy the release gate.

Manual runs remain available: leave **publish** off to validate builds only, enable **publish** to publish images, and additionally enable **deploy** to redeploy from `main`. Other branches never deploy. Workflow summaries record the image references for rollback; restore both previous image references together and redeploy. Database migration rollback requires a compatible backup as described below.

The workflow uses Coolify's [bulk environment update API](https://coolify.io/docs/api/endpoints/services/update-envs-by-service-uuid) and [deployment API](https://coolify.io/docs/core/automation/deploy-webhooks). It does not create resources, alter domains or remove volumes. The connection and a live release must be verified on the target instance; local tests mock its API.

## Connected resource

The configured GitHub repository variables target https://app.coolify.io, service pnj4g33ejfgwgpgqkqbeol3v (wassa-east-project-tracker). The Cloudflare connector is a separate resource. Only COOLIFY_TOKEN is a repository secret. The prepared token defaults to a 30-day expiry; replace that secret when rotating or renewing the token. This automation-only release preserves the current saved Compose definition; apply app/Compose changes together in a later application release.

## Verified connection — 6 November 2026

Push-triggered [release run 42191949662](https://github.com/ram2ey/weprojecttracker/actions/runs/42191949662) passed checks, both Linux image builds/publishes and the Coolify deployment step for commit `3981989`. The app's configuration-changes indicator cleared; web and database reported healthy. The existing Cloudflare homepage and `/api/ready` returned HTTP 200, with readiness `true`. The token was saved directly to GitHub Actions and expires after 30 days (6 December 2026). Renew the token and update `COOLIFY_TOKEN` before expiry.

Only deployment automation was published. The reduced app and its migration remain local pending their own release.

## Phase 2 operations

See [the release and recovery runbook](PHASE_2_RELEASE_RUNBOOK.md) for exact retained volumes/image references, domain/TLS cutover, migration/operator recovery, CI gates, token rotation and incident handling. GitHub Actions uptime monitoring is selected with the office IT administrator as triage owner. Activate `MONITOR_ENABLED=true` only after the new workflow is on main and the reduced hosted release is verified. Backup/restore, reduced-app live rollout and monitoring acceptance remain open; local/CI success does not establish production recovery.

On **7 November 2026**, permanent-domain DNS, trusted certificates, app origin and redirects were verified for the existing deployed image pair. See [domain verification](PHASE_2_DOMAIN_VERIFICATION_2026-11-07.md). The reduced register remains in draft PR #1; its coordinated Compose/migration release, final-host staff workflow acceptance and monitor activation remain open. Backups/restore remain deferred.
