import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPayload } from "../src/lib/content/types";
import {
  payloadSchema,
  financialsSchema,
  publicationErrors,
} from "../src/lib/content/validation";
const base = {
  ...emptyPayload,
  title: "Verified project",
  description: "A sufficiently detailed project description.",
  categoryId: "category-education",
  communityId: "community",
  source: "Site visit",
  reportingOffice: "Constituency office",
  objectives: "Improve access.",
  progressExplanation: "Baseline assessment completed.",
};
test("every project status accepts valid progress and requires relevant explanations", () => {
  assert.deepEqual(publicationErrors("project", base, false), []);
  for (const status of ["Delayed", "Suspended", "Cancelled"] as const) {
    assert.ok(
      publicationErrors("project", { ...base, status }, false).some((e) =>
        e.includes("Explain the delay"),
      ),
    );
    assert.deepEqual(
      publicationErrors(
        "project",
        { ...base, status, delayReason: "Documented reason" },
        false,
      ),
      [],
    );
  }
  for (const progress of [-1, 101, 12.5])
    assert.equal(payloadSchema.safeParse({ ...base, progress }).success, false);
});
test("completion and revision publication require a complete evidence package", () => {
  assert.ok(
    publicationErrors(
      "project",
      { ...base, status: "Completed", progress: 100 },
      false,
    ).some((e) => e.includes("Completion requires")),
  );
  const completed = {
    ...base,
    status: "Completed" as const,
    progress: 100,
    actualCompletionDate: "2026-10-28",
    completionSummary: "Completion independently verified.",
    attachments: [
      {
        id: "12345678-1234-4234-8234-123456789012",
        caption: "Site evidence",
        capturedOn: "",
        visibility: "public" as const,
        purpose: "evidence" as const,
      },
    ],
  };
  assert.deepEqual(publicationErrors("project", completed, false), []);
  assert.ok(
    publicationErrors("project", completed, true).some((e) =>
      e.includes("changes"),
    ),
  );
  assert.ok(
    publicationErrors(
      "project",
      { ...completed, actualCompletionDate: "2999-01-01" },
      false,
    ).some((e) => e.includes("future")),
  );
});
test("financial attachments, invalid dates and unsafe URLs are rejected", () => {
  assert.equal(
    payloadSchema.safeParse({
      ...base,
      attachments: [
        {
          id: "12345678-1234-4234-8234-123456789012",
          caption: "",
          capturedOn: "",
          visibility: "public",
          purpose: "financial",
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    payloadSchema.safeParse({ ...base, startDate: "2026-02-30" }).success,
    false,
  );
  for (const url of [
    "javascript:alert(1)",
    "https://unapproved.invalid/watch",
    "http://youtube.com/watch",
  ]) {
    assert.equal(
      payloadSchema.safeParse({ ...base, videoLinks: [url] }).success,
      false,
    );
  }
  assert.equal(
    payloadSchema.safeParse({
      ...base,
      references: [{ label: "Unsafe", url: "javascript:alert(1)" }],
    }).success,
    false,
  );
  assert.ok(
    publicationErrors("project", { ...base, latitude: 5 }, false).some((e) =>
      e.includes("both GPS"),
    ),
  );
  assert.equal(
    financialsSchema.safeParse({
      budget: "-1",
      expenditure: "0",
      fundingSource: "",
      currency: "GHS",
      internalNotes: "",
    }).success,
    false,
  );
});
