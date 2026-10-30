import { test } from "node:test";
import assert from "node:assert/strict";
import { publicFiltersSchema, filterQuery } from "../src/lib/content/filters";
test("public search rejects malformed dates, invalid ranges, statuses and unbounded queries", () => {
  for (const input of [
    { from: "2026-02-30" },
    { from: "2026-10-20", to: "2026-10-01" },
    { status: "Secret" },
    { q: "x".repeat(201) },
    { page: 0 },
    { page: 1.2 },
    { sort: "unsafe" },
    { category: ["a", "b"] },
  ])
    assert.equal(publicFiltersSchema.safeParse(input).success, false);
  assert.equal(
    publicFiltersSchema.safeParse({ from: "2026-10-20", to: "2026-10-20" })
      .success,
    true,
  );
});
test("public filter links preserve relevant choices and reset pagination explicitly", () => {
  const filters = publicFiltersSchema.parse({
    q: "classroom & roof",
    community: "North",
    page: 2,
    from: "",
    status: "",
  });
  const query = new URLSearchParams(
    filterQuery({ ...filters, view: "map" }, { page: "3" }),
  );
  assert.equal(query.get("q"), "classroom & roof");
  assert.equal(query.get("page"), "3");
  assert.equal(query.get("view"), "map");
  assert.equal(query.has("from"), false);
  assert.equal(query.has("status"), false);
});
