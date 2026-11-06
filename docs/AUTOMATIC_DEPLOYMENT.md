# Automatic deployment from GitHub

`.github/workflows/container-images.yml` runs on pushes to `main`. It runs lint, type checking and unit tests, builds and publishes both Linux images on GitHub runners, updates only `WEB_IMAGE` and `TOOLS_IMAGE` in the selected Coolify resource, then requests a redeploy. A failed check or image build prevents deployment. Each release tag includes the commit, workflow run ID and attempt; reruns do not overwrite the previous release's images. Releases are serialized instead of cancelling an active deployment.

One-time connection setup:

1. Select the **app resource** in Coolify's Wassa East project tracker project. Use its resource UUID, not the project UUID, domain or another resource's UUID. For Docker Compose Empty the resource type is `service`; for a Git-based Docker Compose application it is `application`.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add the repository secret `COOLIFY_TOKEN` (a Coolify API token authorized to update environment variables and deploy this resource). Add repository variables `COOLIFY_URL` (the HTTPS dashboard origin without `/api/v1`), `COOLIFY_RESOURCE_UUID`, and `COOLIFY_RESOURCE_TYPE` (`service` or `application` from step 1). Keep tokens out of source control and chat.
3. Ensure this resource uses the current `compose.coolify.yaml`, with `WEB_IMAGE` and `TOOLS_IMAGE` variables, migrations and persistent database/media volumes. For an existing Docker Compose Empty resource, update its saved Compose definition once; pushing Git does not update that saved definition. Retain its domain, secrets and existing volumes. The temporary Cloudflare hostname does not need a separate deployment trigger.
4. Ensure the Coolify server can pull `ghcr.io/ram2ey/weprojecttracker-web` and `ghcr.io/ram2ey/weprojecttracker-tools`. Private packages require registry credentials on the server. Disable any separate deploy-on-push webhook on this app so it cannot race the image builds. Its API must be reachable from GitHub runners.
5. Commit and push the release workflow, script and app changes to `main`. Open **Actions → Release to Coolify** to follow the checks, builds and deployment. Missing connection settings fail clearly before image builds. Application deployments wait for Coolify's deployment status; service redeploys report API acceptance, so confirm container health in the Coolify dashboard after the first release.

Manual runs remain available: leave **publish** off to validate builds only, enable **publish** to publish images, and additionally enable **deploy** to redeploy from `main`. Other branches never deploy. Workflow summaries record the image references for rollback; restore both previous image references together and redeploy. Database migration rollback requires a compatible backup as described below.

The workflow uses Coolify's [bulk environment update API](https://coolify.io/docs/api/endpoints/services/update-envs-by-service-uuid) and [deployment API](https://coolify.io/docs/core/automation/deploy-webhooks). It does not create resources, alter domains or remove volumes. The connection and a live release must be verified on the target instance; local tests mock its API.

## Connected resource

The configured GitHub repository variables target https://app.coolify.io, service pnj4g33ejfgwgpgqkqbeol3v (wassa-east-project-tracker). The Cloudflare connector is a separate resource. Only COOLIFY_TOKEN is a repository secret. The prepared token defaults to a 30-day expiry; replace that secret when rotating or renewing the token. This automation-only release preserves the current saved Compose definition; apply app/Compose changes together in a later application release.
