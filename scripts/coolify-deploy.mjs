import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { publicOrigin, smokePublicApp } from "./public-smoke.mjs";

export function validateServiceCompose(raw) {
  let services;
  try {
    services = parse(raw)?.services;
  } catch {
    throw new Error(
      "Saved Compose could not be parsed. Check it privately in Coolify.",
    );
  }
  if (
    !services?.web ||
    !services?.migrate ||
    !services?.database ||
    services.worker
  )
    throw new Error(
      "Saved Compose must contain web/migrate/database and no retired worker.",
    );
  if (
    services.web.image !== "${WEB_IMAGE:?}" ||
    services.migrate.image !== "${TOOLS_IMAGE:?}" ||
    services.web.depends_on?.migrate?.condition !==
      "service_completed_successfully" ||
    services.database.ports?.length ||
    !services.web.volumes?.includes("media:/data/media") ||
    !services.database.volumes?.includes("postgres:/var/lib/postgresql/data")
  )
    throw new Error(
      "Saved Compose image references, migration dependency or retained volumes are incorrect.",
    );
}

export function serviceHealthy(service) {
  const healthy = (value) =>
    /^running(?::|\s*\()healthy\)?$/i.test(value || "");
  return (
    healthy(service.applications?.find((app) => app.name === "web")?.status) &&
    healthy(service.databases?.find((db) => db.name === "database")?.status)
  );
}

export function deploymentConfig(env) {
  publicOrigin(env.PUBLIC_APP_URL);
  for (const key of ["COOLIFY_URL", "COOLIFY_TOKEN", "COOLIFY_RESOURCE_UUID"]) {
    if (!env[key]?.trim())
      throw new Error(`Missing GitHub Actions setting: ${key}`);
  }
  const url = new URL(env.COOLIFY_URL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "COOLIFY_URL must be an HTTPS origin without credentials or query parameters.",
    );
  }
  if (url.pathname !== "/")
    throw new Error(
      "COOLIFY_URL must be the dashboard origin, without /api/v1.",
    );
  const type = env.COOLIFY_RESOURCE_TYPE;
  if (!["application", "service"].includes(type)) {
    throw new Error(
      "Set GitHub Actions variable COOLIFY_RESOURCE_TYPE to application or service.",
    );
  }
  if (!/^[a-zA-Z0-9-]+$/.test(env.COOLIFY_RESOURCE_UUID)) {
    throw new Error("Invalid COOLIFY_RESOURCE_UUID.");
  }
  return {
    origin: url.origin,
    token: env.COOLIFY_TOKEN,
    uuid: env.COOLIFY_RESOURCE_UUID,
    type,
  };
}

export async function deploy(
  env,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = console.log,
  } = {},
) {
  const config = deploymentConfig(env);
  const origin = publicOrigin(env.PUBLIC_APP_URL);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(env.GITHUB_REPOSITORY ?? "")) {
    throw new Error("Invalid GITHUB_REPOSITORY.");
  }
  if (!/^sha-[a-f0-9]{40}-\d+-\d+$/.test(env.IMAGE_TAG ?? "")) {
    throw new Error("Invalid release IMAGE_TAG.");
  }
  const imagePrefix = `ghcr.io/${env.GITHUB_REPOSITORY.toLowerCase()}`;
  const images = {
    WEB_IMAGE: `${imagePrefix}-web:${env.IMAGE_TAG}`,
    TOOLS_IMAGE: `${imagePrefix}-tools:${env.IMAGE_TAG}`,
  };
  async function request(path, method = "GET", body) {
    let response;
    try {
      response = await fetchImpl(`${config.origin}/api/v1${path}`, {
        method,
        redirect: "error",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new Error(
        `Coolify ${method} request failed. Check connectivity and the API URL.`,
      );
    }
    // API responses can contain secrets. Never print response bodies or headers.
    if (!response.ok)
      throw new Error(
        `Coolify ${method} request failed (HTTP ${response.status}).`,
      );
    try {
      return await response.json();
    } catch {
      throw new Error("Coolify returned invalid JSON.");
    }
  }
  const resourcePath = `/${config.type}s/${encodeURIComponent(config.uuid)}`;
  if (config.type === "service") {
    const saved = await request(resourcePath);
    validateServiceCompose(saved.docker_compose_raw);
  }
  // Update both references before requesting a deployment; leave all other envs intact.
  await request(`${resourcePath}/envs/bulk`, "PATCH", {
    data: Object.entries(images).map(([key, value]) => ({
      key,
      value,
      is_preview: false,
      is_literal: true,
    })),
  });
  const result = await request("/deploy", "POST", {
    uuid: config.uuid,
    force: false,
  });
  const deployment = result.deployments?.[0];
  if (
    !deployment ||
    deployment.error ||
    (deployment.resource_uuid && deployment.resource_uuid !== config.uuid) ||
    (config.type === "service" &&
      !/^Service .+ started\./.test(deployment.message ?? ""))
  )
    throw new Error(
      "Coolify did not accept the deployment. Check the dashboard.",
    );
  log(`Coolify accepted release ${env.IMAGE_TAG}.`);
  if (config.type === "application") {
    if (!/^[a-zA-Z0-9-]+$/.test(deployment.deployment_uuid ?? "")) {
      throw new Error(
        "Coolify did not return a deployment UUID. Check the dashboard.",
      );
    }
    // Keep this release serialized until Coolify finishes replacing its containers.
    let finished = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      await sleep(10_000);
      const status = await request(
        `/deployments/${deployment.deployment_uuid}`,
      );
      if (status.status === "finished") {
        finished = true;
        break;
      }
      if (/failed|cancelled|error/.test(status.status ?? "")) {
        throw new Error(
          "Coolify deployment failed or was cancelled. Check its deployment logs.",
        );
      }
    }
    if (!finished)
      throw new Error(
        "Timed out waiting for Coolify. Check the dashboard before retrying.",
      );
    log("Coolify deployment finished.");
  } else {
    let finished = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(10000);
      const service = await request(resourcePath);
      if (!serviceHealthy(service)) continue;
      try {
        await smokePublicApp(origin, {
          release: env.IMAGE_TAG,
          full: false,
          fetchImpl: fetchImpl,
        });
        finished = true;
        break;
      } catch {
        /* An old or starting container must not satisfy this release. */
      }
    }
    if (!finished)
      throw new Error(
        "Timed out waiting for healthy replacement containers and the expected migrated release.",
      );
  }
  await smokePublicApp(origin, { release: env.IMAGE_TAG, fetchImpl });
  log("Expected release, migrations and public smoke checks passed.");
  return images;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.includes("--check")) {
      deploymentConfig(process.env);
      console.log("Coolify deployment configuration is present.");
    } else {
      const images = await deploy(process.env);
      if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(
          process.env.GITHUB_STEP_SUMMARY,
          `\nCoolify release images:\n\n- Web: \`${images.WEB_IMAGE}\`\n- Tools: \`${images.TOOLS_IMAGE}\`\n`,
        );
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
