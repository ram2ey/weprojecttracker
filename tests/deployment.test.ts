import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { checkDeployment } from "../scripts/check-deployment";

function valid(): Record<string, string | undefined> {
  return {
    APP_URL: "https://projects.wassa-east.org",
    WEB_IMAGE: `ghcr.io/owner/wassa-web@sha256:${"a".repeat(64)}`,
    TOOLS_IMAGE: `ghcr.io/owner/wassa-tools@sha256:${"b".repeat(64)}`,
    POSTGRES_PASSWORD: randomBytes(32).toString("base64url"),
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  };
}
test("Production configuration allows pinned images and defers Google without blocking preparation", () => {
  const result = checkDeployment(valid());
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Google/);
});
test("Production rejects unsafe origins, unversioned images and development flags", () => {
  for (const APP_URL of [
    "http://projects.wassa-east.org",
    "https://localhost",
    "https://app.local",
    "https://projects.wassa-east.org:3000",
    "https://projects.wassa-east.org/staff",
    "https://a:b@projects.wassa-east.org",
  ]) {
    assert.ok(
      checkDeployment({ ...valid(), APP_URL }).errors.some((e) =>
        e.startsWith("APP_URL"),
      ),
    );
  }
  for (const WEB_IMAGE of [
    "wassa-web:local",
    "ghcr.io/owner/web:latest",
    "ghcr.io/owner/web",
    "ghcr.io/owner/web@sha256:1234",
  ]) {
    assert.ok(
      checkDeployment({ ...valid(), WEB_IMAGE }).errors.some((e) =>
        e.startsWith("WEB_IMAGE"),
      ),
    );
  }
  for (const key of ["ENABLE_DESIGN_PREVIEW", "ENABLE_BROWSER_PUSH"])
    assert.ok(
      checkDeployment({ ...valid(), [key]: "true" }).errors.some((e) =>
        e.startsWith(key),
      ),
    );
});
test("Production rejects missing/reused secrets and partial OAuth without including their values", () => {
  const env = valid();
  env.POSTGRES_PASSWORD = env.BETTER_AUTH_SECRET;
  env.MFA_ENCRYPTION_KEY = "private-invalid-key";
  env.GOOGLE_CLIENT_ID = "private-client-id";
  const result = checkDeployment(env);
  assert.equal(result.errors.length, 3);
  for (const secret of [
    env.BETTER_AUTH_SECRET!,
    env.MFA_ENCRYPTION_KEY,
    env.GOOGLE_CLIENT_ID,
  ])
    assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(checkDeployment({}).errors.length >= 6);
});
