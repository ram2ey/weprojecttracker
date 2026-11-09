import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { deliverEnquiry, enquiryInput } from "../src/lib/contact-delivery";
import { storeListing } from "../src/lib/store-listing";

test("enquiry uses a fixed destination and a repeatable submission key", async () => {
  const input = enquiryInput.parse({
    id: randomUUID(),
    name: "Resident",
    email: "reader@example.org",
    subject: "School project",
    message: "When was the last update?",
  });
  const mail = {
    key: "test",
    from: "web@example.org",
    to: "office@example.org",
  };
  const sent: Request[] = [];
  const send: typeof fetch = async (url, init) => {
    sent.push(new Request(url, init));
    return Response.json({ id: "accepted" });
  };
  await deliverEnquiry(input, mail, send);
  await deliverEnquiry(input, mail, send);
  assert.equal(
    sent[0].headers.get("Idempotency-Key"),
    sent[1].headers.get("Idempotency-Key"),
  );
  const body = await sent[0].json();
  assert.deepEqual(body.to, [mail.to]);
  assert.equal(body.reply_to, input.email);
  assert.match(body.text, /When was the last update/);
  assert.equal(
    enquiryInput.safeParse({ ...input, to: "elsewhere@example.org" }).success,
    false,
  );
  await assert.rejects(
    deliverEnquiry(
      input,
      mail,
      async () => new Response(null, { status: 503 }),
    ),
  );
});
test("store links require an official listing for the matching platform", () => {
  const google =
    "https://play.google.com/store/apps/details?id=org.example.app";
  const apple = "https://apps.apple.com/gh/app/example/id12345";
  assert.equal(storeListing("google", google), google);
  assert.equal(storeListing("apple", apple), apple);
  for (const url of [
    undefined,
    google.replace("https:", "http:"),
    "https://play.google.com/",
    apple,
  ])
    assert.equal(storeListing("google", url), undefined);
});
