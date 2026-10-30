import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { publicRender } from "../src/lib/content/render-cache";
test("anonymous public renders reuse a version key and a new publication key renders afresh", async () => {
  const key = randomUUID();
  let count = 0;
  const render = async () => {
    count++;
    return new Response("<h1>Approved public snapshot</h1>", {
      headers: {
        "Content-Type": "text/html",
        "X-Public-Cache": "public-page-v1",
      },
    });
  };
  assert.equal((await publicRender(key, render)).hit, false);
  assert.equal((await publicRender(key, render)).hit, true);
  assert.equal(count, 1);
  await publicRender(key + ":new-publication", render);
  assert.equal(count, 2);
});
test("personalised, unmarked, missing and oversized responses never enter the render cache", async () => {
  const scenarios: ResponseInit[] = [
    {
      headers: {
        "Content-Type": "text/html",
        "X-Public-Cache": "public-page-v1",
        "Set-Cookie": "private=token",
      },
    },
    { headers: { "Content-Type": "text/html" } },
    {
      status: 404,
      headers: {
        "Content-Type": "text/html",
        "X-Public-Cache": "public-page-v1",
      },
    },
  ];
  for (const options of scenarios) {
    const key = randomUUID();
    let calls = 0;
    const render = async () => {
      calls++;
      return new Response("private or unavailable", options);
    };
    assert.equal((await publicRender(key, render)).entry, null);
    await publicRender(key, render);
    assert.equal(calls, 2);
  }
  const large = await publicRender(
    randomUUID(),
    async () =>
      new Response("x".repeat(1_600_000), {
        headers: {
          "Content-Type": "text/html",
          "X-Public-Cache": "public-page-v1",
        },
      }),
  );
  assert.equal(large.entry, null);
});
