import test from "node:test";
import assert from "node:assert/strict";
import { commentInput } from "../src/lib/comments/policy";
import {
  commentCookie,
  createCommentGuard,
  readCommentGuard,
} from "../src/lib/comments/guard";

test("comments require bounded, plain text fields and an explicit submission identifier", () => {
  const base = {
    submissionId: crypto.randomUUID(),
    displayName: " Visitor ",
    body: " Good work.\nThank you. ",
    website: "",
  };
  assert.equal(commentInput.parse(base).displayName, "Visitor");
  assert.equal(commentInput.parse(base).body, "Good work.\nThank you.");
  for (const change of [
    { displayName: " " },
    { displayName: "x".repeat(81) },
    { body: "x".repeat(2001) },
    { body: "bad\0text" },
    { displayName: "two\nlines" },
    { submissionId: "not-a-uuid" },
    { email: "unrequested@example.invalid" },
  ]) {
    assert.equal(commentInput.safeParse({ ...base, ...change }).success, false);
  }
  assert.equal(
    commentInput.parse({
      ...base,
      body: "<script>alert(1)</script> https://example.invalid",
    }).body,
    "<script>alert(1)</script> https://example.invalid",
  );
});

test("comment guards are signed, expire, and reject forged or ambiguous cookies", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "synthetic-comment-guard-unit-test-secret";
  try {
    const now = Date.UTC(2026, 10, 7),
      token = createCommentGuard(now),
      cookie = `${commentCookie}=${token}`;
    assert.ok(readCommentGuard(cookie, now));
    assert.equal(readCommentGuard(cookie, now + 86400_000), null);
    assert.equal(readCommentGuard(cookie, now - 2000), null);
    const forged = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    assert.equal(readCommentGuard(`${commentCookie}=${forged}`, now), null);
    assert.equal(readCommentGuard(cookie + "; " + cookie, now), null);
    assert.equal(readCommentGuard("", now), null);
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});
