import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPayload } from "../src/lib/content/types";
import {
  launchPayload,
  payloadSchema,
  publicationErrors,
} from "../src/lib/content/validation";
import {
  publicFiltersSchema,
  parsePageFilters,
  filterQuery,
} from "../src/lib/content/filters";
import { usernameSchema } from "../src/lib/security/usernames";
import { checkDeployment } from "../scripts/check-deployment";
test("launch DTO excludes all legacy fields and private attachments", () => {
  const p = launchPayload({
    ...emptyPayload,
    title: "A project",
    progress: 77,
    objectives: "PRIVATE",
    attachments: [
      {
        id: crypto.randomUUID(),
        caption: "Private",
        capturedOn: "",
        purpose: "financial",
        visibility: "internal",
      },
    ],
  });
  assert.equal("progress" in p, false);
  assert.equal("objectives" in p, false);
  assert.equal(p.attachments.length, 0);
  assert.equal(payloadSchema.safeParse({ ...p, progress: 10 }).success, false);
});
test("completion requires a date, summary and photograph; other statuses do not", () => {
  const p = {
    ...launchPayload(emptyPayload),
    title: "A learning space",
    description: "A documented learning space for the community.",
    source: "Field notes",
    categoryId: "category-education",
    communityId: "community",
  };
  assert.deepEqual(publicationErrors(p), []);
  assert.ok(publicationErrors({ ...p, status: "Completed" }).length);
  assert.deepEqual(
    publicationErrors({
      ...p,
      status: "Completed",
      actualCompletionDate: "2026-01-01",
      completionSummary: "Construction completed and checked.",
      attachments: [{ id: crypto.randomUUID(), caption: "Completed school" }],
    }),
    [],
  );
  assert.ok(
    publicationErrors({
      ...p,
      status: "Completed",
      actualCompletionDate: "2999-01-01",
    }).length,
  );
});
test("filters reject retired controls and preserve active choices", () => {
  assert.equal(
    publicFiltersSchema.safeParse({ from: "2026-01-01" }).success,
    false,
  );
  assert.equal(
    publicFiltersSchema.safeParse({ sort: "progress" }).success,
    false,
  );
  assert.equal(publicFiltersSchema.safeParse({ page: 1.5 }).success, false);
  const f = publicFiltersSchema.parse({
    q: "School",
    community: "Daboase",
    status: "Ongoing",
  });
  assert.equal(
    new URLSearchParams(filterQuery(f, { q: undefined, page: undefined })).get(
      "community",
    ),
    "Daboase",
  );
});
test("usernames normalize case and reject unsafe identifiers", () => {
  assert.equal(usernameSchema.parse("  PROJECT_EDITOR  "), "project_editor");
  for (const username of [
    "a",
    "email@example.com",
    "two words",
    "x".repeat(31),
  ])
    assert.equal(usernameSchema.safeParse(username).success, false);
});

test("page filters ignore tracking parameters while validating register controls", () => {
  const result = parsePageFilters({
    q: "school",
    category: "Education",
    page: "2",
    utm_source: "newsletter",
    fbclid: "social-click",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.q, "school");
    assert.equal(result.data.category, "Education");
    assert.equal(result.data.page, 2);
    assert.equal("utm_source" in result.data, false);
  }
  assert.equal(
    parsePageFilters({ status: "invalid", utm_source: "newsletter" }).success,
    false,
  );
  assert.equal(
    parsePageFilters({ page: "0", fbclid: "social-click" }).success,
    false,
  );
  assert.equal(parsePageFilters({ q: ["first", "second"] }).success, false);
  assert.equal(
    publicFiltersSchema.safeParse({ q: "school", utm_source: "newsletter" })
      .success,
    false,
  );
});
test("deployment needs no retired provider or MFA credentials", () => {
  const result = checkDeployment({
    APP_URL: "https://projects.example.org",
    WEB_IMAGE: "ghcr.io/example/web:release-001",
    TOOLS_IMAGE: "ghcr.io/example/tools:release-001",
    POSTGRES_PASSWORD: "a".repeat(40),
    BETTER_AUTH_SECRET: "b".repeat(40),
  });
  assert.deepEqual(result.errors, []);
  assert.equal(
    result.warnings.some((w) => /Google|MFA|map/i.test(w)),
    false,
  );
});
