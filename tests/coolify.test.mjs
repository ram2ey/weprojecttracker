import assert from "node:assert/strict";
import test from "node:test";
import { deploy, deploymentConfig } from "../scripts/coolify-deploy.mjs";

const env = {
  COOLIFY_URL: "https://coolify.example.com",
  COOLIFY_TOKEN: "private-test-token",
  COOLIFY_RESOURCE_UUID: "target123",
  COOLIFY_RESOURCE_TYPE: "application",
  GITHUB_REPOSITORY: "Example/Register",
  IMAGE_TAG: `sha-${"a".repeat(40)}-123-1`,
};

function harness(responses) {
  const calls = [];
  return {
    calls,
    options: {
      sleep: async () => {},
      log: () => {},
      fetchImpl: async (url, options) => {
        calls.push({ url, ...options });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        assert.ok(next, "Unexpected API request");
        return Response.json(next.body, { status: next.status ?? 200 });
      },
    },
  };
}

test("release updates only both image references before deploying and waits for completion", async () => {
  const mock = harness([
    { body: [] },
    { body: { deployments: [{ deployment_uuid: "deploy123" }] } },
    { body: { status: "in_progress" } },
    { body: { status: "finished" } },
  ]);
  const images = await deploy(env, mock.options);
  assert.match(images.WEB_IMAGE, /^ghcr.io\/example\/register-web:sha-/);
  assert.equal(
    images.TOOLS_IMAGE,
    `ghcr.io/example/register-tools:${env.IMAGE_TAG}`,
  );
  assert.equal(mock.calls[0].method, "PATCH");
  assert.match(mock.calls[0].url, /\/applications\/target123\/envs\/bulk$/);
  assert.deepEqual(
    JSON.parse(mock.calls[0].body).data.map(({ key, value }) => [key, value]),
    Object.entries(images),
  );
  assert.equal(mock.calls[0].redirect, "error");
  assert.match(mock.calls[1].url, /\/deploy$/);
  assert.equal(mock.calls[1].method, "POST");
  assert.deepEqual(JSON.parse(mock.calls[1].body), {
    uuid: "target123",
    force: false,
  });
  assert.equal(mock.calls.length, 4);
});

test("Docker Compose Empty service uses the service endpoint", async () => {
  const mock = harness([
    { body: [] },
    {
      body: {
        deployments: [
          {
            resource_uuid: "target123",
            message:
              "Service Wassa East started. It could take a while, be patient.",
          },
        ],
      },
    },
  ]);
  await deploy({ ...env, COOLIFY_RESOURCE_TYPE: "service" }, mock.options);
  assert.match(mock.calls[0].url, /\/services\/target123\/envs\/bulk$/);
  assert.equal(mock.calls.length, 2);
});

test("configuration errors fail before making requests", async () => {
  assert.throws(
    () => deploymentConfig({ ...env, COOLIFY_TOKEN: "" }),
    /COOLIFY_TOKEN/,
  );
  assert.throws(
    () => deploymentConfig({ ...env, COOLIFY_URL: "http://example.com" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      deploymentConfig({ ...env, COOLIFY_URL: "https://example.com/api/v1" }),
    /without \/api/,
  );
  assert.throws(
    () => deploymentConfig({ ...env, COOLIFY_RESOURCE_TYPE: "" }),
    /application or service/,
  );
  const mock = harness([]);
  await assert.rejects(
    deploy({ ...env, IMAGE_TAG: "latest" }, mock.options),
    /IMAGE_TAG/,
  );
  assert.equal(mock.calls.length, 0);
});

test("a service permission error returned inside HTTP 200 fails the release", async () => {
  const mock = harness([
    { body: [] },
    {
      body: {
        deployments: [
          {
            resource_uuid: "target123",
            message: "Unauthorized to deploy this service.",
          },
        ],
      },
    },
  ]);
  await assert.rejects(
    deploy({ ...env, COOLIFY_RESOURCE_TYPE: "service" }, mock.options),
    /did not accept/,
  );
});

test("failed env update never triggers deployment or exposes the API response", async () => {
  const mock = harness([{ status: 401, body: { message: env.COOLIFY_TOKEN } }]);
  await assert.rejects(deploy(env, mock.options), (error) => {
    assert.match(error.message, /HTTP 401/);
    assert.ok(!error.message.includes(env.COOLIFY_TOKEN));
    return true;
  });
  assert.equal(mock.calls.length, 1);
});

test("network failures are reported without leaking connection details", async () => {
  const mock = harness([new Error(env.COOLIFY_TOKEN)]);
  await assert.rejects(deploy(env, mock.options), /Check connectivity/);
  assert.equal(mock.calls.length, 1);
});

test("unaccepted and failed deployments fail the release", async () => {
  const unaccepted = harness([{ body: [] }, { body: { deployments: [] } }]);
  await assert.rejects(deploy(env, unaccepted.options), /did not accept/);
  const failed = harness([
    { body: [] },
    { body: { deployments: [{ deployment_uuid: "deploy123" }] } },
    { body: { status: "failed" } },
  ]);
  await assert.rejects(deploy(env, failed.options), /deployment failed/);
});
