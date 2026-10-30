import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  canApprove,
  hasAdministrativeAccess,
} from "../src/lib/security/policy";
import {
  encrypt,
  decrypt,
  newTotp,
  validateTotp,
  makeRecoveryCodes,
  hashToken,
} from "../src/lib/security/crypto";
import { isDesignPreview, validateRuntime } from "../src/lib/env";

test("No role, including the operator, can approve their own submission", () => {
  for (const role of ["officer", "approver", "super_admin"] as const)
    assert.equal(canApprove(role, "author", "author"), false);
  assert.equal(canApprove("officer", "other", "author"), false);
  assert.equal(canApprove("approver", "other", "author"), true);
});
test("A first-factor session never grants administrative access without an MFA proof", () => {
  assert.equal(
    hasAdministrativeAccess({
      active: true,
      mfaEnabled: true,
      proofExpiresAt: null,
    }),
    false,
  );
  assert.equal(
    hasAdministrativeAccess({
      active: true,
      mfaEnabled: false,
      proofExpiresAt: new Date(Date.now() + 60000),
    }),
    false,
  );
  assert.equal(
    hasAdministrativeAccess({
      active: false,
      mfaEnabled: true,
      proofExpiresAt: new Date(Date.now() + 60000),
    }),
    false,
  );
  assert.equal(
    hasAdministrativeAccess({
      active: true,
      mfaEnabled: true,
      proofExpiresAt: new Date(Date.now() - 60000),
    }),
    false,
  );
});
test("Encrypted authenticator secrets reject tampering and the wrong encryption key", () => {
  const previous = process.env.MFA_ENCRYPTION_KEY;
  try {
    process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    const ciphertext = encrypt("private-authenticator-seed");
    assert.equal(decrypt(ciphertext), "private-authenticator-seed");
    const bytes = Buffer.from(ciphertext, "base64url");
    bytes[bytes.length - 1] ^= 1;
    assert.throws(() => decrypt(bytes.toString("base64url")));
    process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    assert.throws(() => decrypt(ciphertext));
  } finally {
    if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = previous;
  }
});
test("A consumed TOTP cannot be replayed, and expired codes fail", () => {
  const totp = newTotp("test@example.invalid");
  const now = 1800000000000;
  const code = totp.generate({ timestamp: now });
  const step = validateTotp(totp.secret.base32, code, -1, now);
  assert.notEqual(step, null);
  assert.equal(validateTotp(totp.secret.base32, code, step!, now), null);
  assert.equal(validateTotp(totp.secret.base32, code, -1, now + 120000), null);
  assert.equal(validateTotp(totp.secret.base32, "not-a-code", -1, now), null);
});
test("Recovery codes are independent random secrets stored only as hashes", () => {
  const codes = makeRecoveryCodes();
  assert.equal(new Set(codes).size, 8);
  for (const code of codes) {
    assert.match(code, /^[a-f0-9]{16}$/);
    assert.notEqual(hashToken(code), code);
  }
});
test("Production cannot enable design fixtures, even if the preview flag is set", () => {
  const previous = { ...process.env };
  try {
    process.env.APP_ENV = "production";
    process.env.ENABLE_DESIGN_PREVIEW = "true";
    process.env.DATABASE_URL = "postgresql://localhost/test";
    process.env.BETTER_AUTH_SECRET = "x".repeat(40);
    process.env.MFA_ENCRYPTION_KEY = "a".repeat(64);
    process.env.BETTER_AUTH_URL = "https://projects.example.invalid";
    assert.equal(isDesignPreview(), false);
    assert.throws(validateRuntime, /preview/i);
    process.env.ENABLE_DESIGN_PREVIEW = "false";
    process.env.BETTER_AUTH_URL = "http://example.invalid";
    assert.throws(validateRuntime, /HTTPS/);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
