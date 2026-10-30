import { test } from "node:test";
import assert from "node:assert/strict";
import robots from "../src/app/robots";
test("production robots allow public preview images while excluding private surfaces", () => {
  const previous = process.env.APP_ENV;
  try {
    process.env.APP_ENV = "production";
    const rules = robots().rules as { allow: string[]; disallow: string[] };
    assert.ok(rules.allow.includes("/api/og"));
    assert.ok(rules.disallow.includes("/admin"));
    assert.ok(rules.disallow.includes("/staff"));
    process.env.APP_ENV = "development";
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
  } finally {
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
  }
});
