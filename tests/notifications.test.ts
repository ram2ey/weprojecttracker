import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import {
  allowedEndpoint,
  cookieToken,
  newToken,
  encryptSubscription,
  decryptSubscription,
  deliveryOutcome,
  retrySeconds,
  projectEventKind,
  pushConfiguration,
  subscriptionSchema,
} from "../src/lib/notifications/policy";
import { publicAddress } from "../src/lib/notifications/transport";

test("push targets reject local networks, misleading hosts and redirect-friendly URLs", () => {
  for (const url of [
    "http://fcm.googleapis.com/a",
    "https://127.0.0.1/a",
    "https://fcm.googleapis.com.evil.test/a",
    "https://user@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:444/a",
    "https://fcm.googleapis.com/a#fragment",
    "https://push.apple.com.evil.test/a",
  ])
    assert.equal(allowedEndpoint(url), false, url);
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "172.16.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "0.0.0.0",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(
    allowedEndpoint("https://fcm.googleapis.com/fcm/send/test"),
    true,
  );
  assert.equal(allowedEndpoint("https://web.push.apple.com/test"), true);
});
test("device cookies reject ambiguity and ciphertext is bound to its owning device", () => {
  const token = newToken();
  assert.equal(cookieToken(`wassa_notifications=${token}`), token);
  assert.equal(
    cookieToken(`wassa_notifications=${token}; wassa_notifications=${token}`),
    null,
  );
  assert.equal(cookieToken("wassa_notifications=guessed"), null);
  process.env.NOTIFICATION_ENCRYPTION_KEY =
    randomBytes(32).toString("base64url");
  const value = {
    endpoint: "https://fcm.googleapis.com/test",
    keys: {
      p256dh: webpush.generateVAPIDKeys().publicKey,
      auth: randomBytes(16).toString("base64url"),
    },
  };
  subscriptionSchema.parse(value);
  const encrypted = encryptSubscription(value, "owner");
  assert.ok(!encrypted.includes(value.endpoint));
  assert.deepEqual(decryptSubscription(encrypted, "owner"), value);
  assert.throws(() => decryptSubscription(encrypted, "other-device"));
});
test("notification policy separates corrections, meaningful publications and provider failures", () => {
  assert.equal(
    projectEventKind(undefined, "Planned", false),
    "project-published",
  );
  assert.equal(projectEventKind("Planned", "Ongoing", false), "status-changed");
  assert.equal(projectEventKind("Planned", "Planned", false), null);
  assert.equal(projectEventKind("Planned", "Planned", true), "project-updated");
  assert.equal(deliveryOutcome(201, 1), "sent");
  assert.equal(deliveryOutcome(410, 1), "expired");
  assert.equal(deliveryOutcome(404, 1), "expired");
  assert.equal(deliveryOutcome(403, 1), "failed");
  assert.equal(deliveryOutcome(429, 1), "retry");
  assert.equal(deliveryOutcome(undefined, 6), "failed");
  assert.equal(retrySeconds(1, "300"), 300);
  assert.equal(retrySeconds(1, "999999999"), 86400);
});
test("enabled delivery requires matching VAPID keys and a separate encryption key", () => {
  assert.deepEqual(pushConfiguration({}), { enabled: false });
  const keys = webpush.generateVAPIDKeys();
  const env = {
    ENABLE_BROWSER_PUSH: "true",
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "https://tracker.example.com",
    NOTIFICATION_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  };
  assert.equal(pushConfiguration(env).enabled, true);
  assert.throws(() =>
    pushConfiguration({
      ...env,
      VAPID_PRIVATE_KEY: webpush.generateVAPIDKeys().privateKey,
    }),
  );
  assert.throws(() =>
    pushConfiguration({ ...env, NOTIFICATION_ENCRYPTION_KEY: "" }),
  );
});
