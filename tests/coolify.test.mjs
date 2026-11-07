import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  deploy,
  deploymentConfig,
  validateServiceCompose,
} from "../scripts/coolify-deploy.mjs";
import { smokePublicApp } from "../scripts/public-smoke.mjs";
import { testDatabaseUrl } from "../scripts/test-database.mjs";

const env = {
  COOLIFY_URL: "https://coolify.example.com",
  COOLIFY_TOKEN: "private-test-token",
  COOLIFY_RESOURCE_UUID: "target123",
  COOLIFY_RESOURCE_TYPE: "service",
  PUBLIC_APP_URL: "https://register.example.com",
  GITHUB_REPOSITORY: "Example/Register",
  IMAGE_TAG: `sha-${"a".repeat(40)}-123-1`,
};
const compose = readFileSync("compose.coolify.yaml", "utf8");
const healthy = {
  applications: [{ name: "web", status: "running:healthy" }],
  databases: [{ name: "database", status: "running:healthy" }],
};
function publicResponse(url, release = env.IMAGE_TAG, migrated = true) {
  const path = new URL(url).pathname;
  if (path === "/api/ready")
    return Response.json({ ready: true, release, migrated });
  if (path === "/projects")
    return new Response(null, {
      status: 308,
      headers: { location: "/?q=school" },
    });
  if (
    [
      "/reports",
      "/announcements",
      "/staff/setup",
      "/api/public/projects/map",
    ].includes(path)
  )
    return new Response(null, { status: 404 });
  if (path === "/api/staff/content") return new Response(null, { status: 403 });
  if (path === "/api/public/content") return Response.json({ items: [] });
  return new Response("ok");
}
function harness(responses, publicFetch = publicResponse) {
  const calls = [];
  return {
    calls,
    options: {
      sleep: async () => {},
      log: () => {},
      fetchImpl: async (url, options) => {
        calls.push({ url, ...options });
        if (url.startsWith(env.PUBLIC_APP_URL)) {
          assert.equal(
            options.headers?.Authorization,
            undefined,
            "Never send the Coolify credential to the public app",
          );
          return publicFetch(url);
        }
        const next = responses.length === 1 ? responses[0] : responses.shift();
        assert.ok(next, "Unexpected API request");
        if (next instanceof Error) throw next;
        return Response.json(next.body, { status: next.status ?? 200 });
      },
    },
  };
}
const preflight = { body: { docker_compose_raw: compose } };
const accepted = {
  body: {
    deployments: [
      {
        resource_uuid: "target123",
        message:
          "Service Wassa East started. It could take a while, be patient.",
      },
    ],
  },
};

test("paired images deploy only after Compose preflight; completion requires replacement health, migration and public smoke", async () => {
  let probes = 0;
  const mock = harness(
    [preflight, { body: [] }, accepted, { body: healthy }],
    (url) => publicResponse(url, ++probes === 1 ? "old" : env.IMAGE_TAG),
  );
  const images = await deploy(env, mock.options);
  const mutations = mock.calls.filter(
    (c) => c.method === "PATCH" || c.method === "POST",
  );
  assert.equal(mock.calls[0].method, "GET");
  assert.deepEqual(
    JSON.parse(mutations[0].body).data.map(({ key, value }) => [key, value]),
    Object.entries(images),
  );
  assert.match(images.TOOLS_IMAGE, /^ghcr.io\/example\/register-tools:sha-/);
  assert.equal(mutations.length, 2);
  assert.ok(mock.calls.filter((c) => c.url.endsWith("/api/ready")).length >= 3);
});
test("old healthy containers or missing migration marker time out and fail the release", async () => {
  for (const [release, migrated] of [
    ["old", true],
    [env.IMAGE_TAG, false],
  ]) {
    const mock = harness(
      [preflight, { body: [] }, accepted, { body: healthy }],
      (url) => publicResponse(url, release, migrated),
    );
    await assert.rejects(deploy(env, mock.options), /Timed out/);
  }
});

test("reviewed repository Compose deploys without sensitive-read access and preserves settings", async () => {
  const mock = harness([
    { body: { uuid: "target123" } },
    { body: [] },
    accepted,
    { body: healthy },
  ]);
  await deploy(
    { ...env, COOLIFY_COMPOSE_FILE: "compose.coolify-demo.yaml" },
    mock.options,
  );
  const update = mock.calls[0];
  assert.equal(update.method, "PATCH");
  assert.ok(update.url.endsWith("/services/target123"));
  const body = JSON.parse(update.body);
  assert.deepEqual(Object.keys(body).sort(), [
    "docker_compose_raw",
    "instant_deploy",
  ]);
  assert.equal(body.instant_deploy, false);
  const raw = Buffer.from(body.docker_compose_raw, "base64").toString("utf8");
  assert.equal(raw, readFileSync("compose.coolify-demo.yaml", "utf8"));
  validateServiceCompose(raw);
  assert.ok(raw.includes("127.0.0.1:33187:3000"));
  assert.ok(mock.calls[1].url.endsWith("/envs/bulk"));
  assert.ok(mock.calls[2].url.endsWith("/deploy"));
});

test("withheld saved Compose and unreviewed file paths fail before release mutation", async () => {
  const hidden = harness([{ body: { uuid: "target123" } }]);
  await assert.rejects(deploy(env, hidden.options), /withheld saved Compose/);
  assert.equal(hidden.calls.length, 1);
  assert.equal(hidden.calls[0].method, "GET");
  for (const file of [
    ".env.local",
    "../compose.coolify.yaml",
    "/tmp/compose.yaml",
  ]) {
    const mock = harness([]);
    await assert.rejects(
      deploy({ ...env, COOLIFY_COMPOSE_FILE: file }, mock.options),
      /reviewed repository/,
    );
    assert.equal(mock.calls.length, 0);
  }
});
test("unhealthy replacement cannot pass even when the public endpoint is ready", async () => {
  const mock = harness([
    preflight,
    { body: [] },
    accepted,
    {
      body: {
        ...healthy,
        applications: [{ name: "web", status: "running:unhealthy" }],
      },
    },
  ]);
  await assert.rejects(deploy(env, mock.options), /Timed out/);
  assert.equal(
    mock.calls.some((c) => c.url.startsWith(env.PUBLIC_APP_URL)),
    false,
  );
});
test("legacy worker, missing migration dependency and renamed media volume block mutation", async () => {
  assert.throws(
    () => validateServiceCompose('secret: "never-log-this'),
    (error) => !error.message.includes("never-log-this"),
  );
  for (const raw of [
    compose.replace("service_completed_successfully", "service_started"),
    compose.replace("media:/data/media", "replacement:/data/media"),
    compose.replace("  media:", "  media: {name: replacement}"),
    compose.replace(
      "      NODE_ENV: production",
      "      RELEASE_ID: override\n      NODE_ENV: production",
    ),
  ]) {
    const mock = harness([{ body: { docker_compose_raw: raw } }]);
    await assert.rejects(deploy(env, mock.options), /Saved Compose/);
    assert.equal(mock.calls.length, 1);
  }
  assert.throws(
    () =>
      validateServiceCompose(compose.replace("  web:", "  worker: {}\n  web:")),
    /retired worker/,
  );
});
test("configuration rejects missing settings, unsafe origins and invalid release before requests", async () => {
  for (const input of [
    { COOLIFY_TOKEN: "" },
    { COOLIFY_URL: "http://example.com" },
    { PUBLIC_APP_URL: "https://user:pass@example.com" },
    { COOLIFY_RESOURCE_TYPE: "" },
  ])
    assert.throws(() => deploymentConfig({ ...env, ...input }));
  const mock = harness([]);
  await assert.rejects(
    deploy({ ...env, IMAGE_TAG: "latest" }, mock.options),
    /IMAGE_TAG/,
  );
  assert.equal(mock.calls.length, 0);
});
test("permission errors in HTTP 200, env failures and connectivity errors fail without leaking credentials", async () => {
  const denied = harness([
    preflight,
    { body: [] },
    { body: { deployments: [{ message: "Unauthorized" }] } },
  ]);
  await assert.rejects(deploy(env, denied.options), /did not accept/);
  for (const response of [
    { status: 401, body: { message: env.COOLIFY_TOKEN } },
    new Error(env.COOLIFY_TOKEN),
  ]) {
    const mock = harness([response]);
    await assert.rejects(
      deploy(env, mock.options),
      (error) => !error.message.includes(env.COOLIFY_TOKEN),
    );
    assert.equal(mock.calls.length, 1);
  }
});
test("application deployment failure fails; success still requires public release verification", async () => {
  const app = { ...env, COOLIFY_RESOURCE_TYPE: "application" };
  const failed = harness([
    { body: [] },
    { body: { deployments: [{ deployment_uuid: "deploy123" }] } },
    { body: { status: "failed" } },
  ]);
  await assert.rejects(deploy(app, failed.options), /deployment failed/);
  const success = harness([
    { body: [] },
    { body: { deployments: [{ deployment_uuid: "deploy123" }] } },
    { body: { status: "finished" } },
  ]);
  await deploy(app, success.options);
  assert.ok(success.calls.some((c) => c.url.endsWith("/api/ready")));
});
test("outage, bad redirect and financial leakage are caught by public checks", async () => {
  for (const override of [
    (url) =>
      new URL(url).pathname === "/api/ready"
        ? new Response(null, { status: 503 })
        : publicResponse(url),
    (url) =>
      new URL(url).pathname === "/projects"
        ? new Response(null, {
            status: 308,
            headers: { location: "https://other.example/" },
          })
        : publicResponse(url),
    (url) =>
      new URL(url).pathname === "/api/public/content"
        ? Response.json({ items: [{ slug: "x", payload: { financials: {} } }] })
        : publicResponse(url),
  ])
    await assert.rejects(
      smokePublicApp(env.PUBLIC_APP_URL, {
        release: env.IMAGE_TAG,
        fetchImpl: override,
      }),
    );
});
test("CI database guard cannot fall back to local or remote credentials", () => {
  for (const input of [
    { CI: "true", DATABASE_URL: "postgres://u:p@127.0.0.1:55432/wassa" },
    {
      CI: "true",
      TEST_DATABASE_URL: "postgres://u:p@production.example:55432/wassa_test",
    },
    { CI: "true", TEST_DATABASE_URL: "postgres://u:p@127.0.0.1:55432/wassa" },
    {
      CI: "true",
      TEST_DATABASE_URL:
        "postgres://u:p@127.0.0.1:55432/wassa_test?host=production.example",
    },
  ])
    assert.throws(() => testDatabaseUrl(input));
  assert.equal(
    testDatabaseUrl({
      CI: "true",
      TEST_DATABASE_URL: "postgres://u:p@127.0.0.1:55432/wassa_test",
    }).pathname,
    "/wassa_test",
  );
});
