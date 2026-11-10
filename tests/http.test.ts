import test from "node:test";
import assert from "node:assert/strict";
import { smallJson } from "../src/lib/security/http";
import {
  addressBucket,
  clientAddress,
} from "../src/lib/security/client-address";
test("abuse limits trust only a single proxy-supplied client address", () => {
  const from = (value?: string) =>
    clientAddress(new Headers(value ? { "x-forwarded-for": value } : {}));
  assert.equal(from("203.0.113.7"), "203.0.113.7");
  assert.equal(from(" ::ffff:203.0.113.7 "), "203.0.113.7");
  // A caller-supplied value followed by the proxy's is not trusted.
  assert.equal(from("198.51.100.1, 203.0.113.7"), null);
  assert.equal(from("not-an-address"), null);
  assert.equal(from(), null);
  // IPv6 subscribers are grouped by their /64 prefix.
  assert.equal(from("2001:db8:a:b:1:2:3:4"), "2001:db8:a:b::/64");
  assert.equal(from("2001:db8:a:b::99"), "2001:db8:a:b::/64");
  assert.equal(from("2001:db8::1"), "2001:db8:0:0::/64");
  assert.deepEqual(addressBucket(new Headers()), {
    key: "address:unknown",
    known: false,
  });
});
test("authentication forms bound declared and streamed JSON bodies", async () => {
  assert.deepEqual(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        body: '{"action":"verify","code":"123456"}',
      }),
    ),
    { action: "verify", code: "123456" },
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        body: "x".repeat(17000),
      }),
    ),
    null,
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Length": "2000000" },
        body: "{}",
      }),
    ),
    null,
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", { method: "POST", body: "{" }),
    ),
    null,
  );
});
