import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceParts } from "../src/lib/content/source-links";
import {
  temporaryPasswordExpired,
  temporaryPasswordExpiry,
} from "../src/lib/security/temporary-password";
import { contentSecurityPolicy } from "../src/lib/security/csp";

test("temporary credentials expire at 24 hours and fail closed without a deadline", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const expires = temporaryPasswordExpiry(now);
  assert.equal(expires.toISOString(), "2026-11-07T12:00:00.000Z");
  const person = {
    mustChangePassword: true,
    temporaryPasswordExpiresAt: expires,
  };
  assert.equal(temporaryPasswordExpired(person, now), false);
  assert.equal(temporaryPasswordExpired(person, expires), true);
  assert.equal(
    temporaryPasswordExpired(
      { ...person, temporaryPasswordExpiresAt: null },
      now,
    ),
    true,
  );
  assert.equal(
    temporaryPasswordExpired({ ...person, mustChangePassword: false }, expires),
    false,
  );
});

test("source links retain every original character and allow only credential-free web URLs", () => {
  const source =
    "Office notes (https://example.org/report).\nhttps://example.org/a_(b) and javascript:alert(1) <script>alert(2)</script> https://user:secret@example.org/private";
  const parts = sourceParts(source);
  assert.equal(parts.map((p) => p.text).join(""), source);
  assert.deepEqual(
    parts.filter((p) => p.href).map((p) => p.href),
    ["https://example.org/report", "https://example.org/a_(b)"],
  );
  assert.equal(
    sourceParts("ftp://example.org").some((p) => p.href),
    false,
  );
});

test("production CSP restricts scripts, connections, frames and forms", () => {
  const policy = contentSecurityPolicy("nonce-fixture", false);
  assert.match(
    policy,
    /script-src 'self' 'nonce-nonce-fixture' 'strict-dynamic'/,
  );
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.match(policy, /connect-src 'self';/);
  assert.match(policy, /frame-src 'none'/);
  assert.match(policy, /form-action 'self'/);
  assert.match(contentSecurityPolicy("development", true), /unsafe-eval/);
});
