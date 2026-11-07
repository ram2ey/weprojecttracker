import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsPath, readConsent } from "../src/lib/analytics-policy";

test("analytics consent requires a current explicit acceptance value", () => {
  assert.equal(readConsent(""), "unknown");
  assert.equal(readConsent("wassa_cookie_consent=v1.accepted"), "accepted");
  assert.equal(
    readConsent("foo=bar; wassa_cookie_consent=v1.rejected"),
    "rejected",
  );
  for (const value of ["true", "accepted", "v0.accepted", "v1.accepted-extra"])
    assert.equal(readConsent("wassa_cookie_consent=" + value), "unknown");
});
test("analytics accepts only canonical public paths and excludes personal/query data", () => {
  for (const path of [
    "/",
    "/about",
    "/contact",
    "/privacy",
    "/projects/new-school-123",
  ])
    assert.equal(analyticsPath(path), path);
  for (const path of [
    null,
    "/admin",
    "/staff/login",
    "/api/staff/content",
    "/?q=personal",
    "/contact#private",
    "https://example.com/",
    "/projects/a?token=secret",
    "/projects/%61",
    "/projects/../staff",
    "/projects/",
  ])
    assert.equal(analyticsPath(path), null);
});
