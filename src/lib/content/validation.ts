import { z } from "zod";
import {
  projectStatuses,
  type ContentKind,
  type ContentPayload,
} from "./types";
const text = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(""), z.iso.date()]);
export const attachmentRefSchema = z
  .object({
    id: z.uuid(),
    caption: text(500),
    capturedOn: date,
    visibility: z.enum(["public", "internal"]),
    purpose: z.enum(["evidence", "financial"]),
  })
  .refine((a) => a.purpose !== "financial" || a.visibility === "internal", {
    message: "Financial attachments must remain internal.",
  });
export const payloadSchema = z
  .object({
    title: text(160).min(3),
    description: text(15000),
    objectives: text(5000),
    categoryId: text(100),
    categoryName: text(120),
    subcategoryId: text(100),
    subcategoryName: text(120),
    communityId: text(100),
    communityName: text(120),
    region: text(120),
    constituency: z.literal("Wassa East"),
    district: text(120),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    status: z.enum(projectStatuses),
    progress: z.number().int().min(0).max(100),
    progressExplanation: text(4000),
    startDate: date,
    expectedCompletionDate: date,
    actualCompletionDate: date,
    completionSummary: text(4000),
    changeSummary: text(4000),
    delayReason: text(4000),
    nextSteps: text(4000),
    source: text(2000),
    responsibleOrganisation: text(300),
    reportingOffice: text(300),
    verificationNotes: text(4000),
    tags: z.array(text(40).min(1)).max(20),
    references: z
      .array(
        z.object({
          label: text(200).min(1),
          url: z.url({ protocol: /^https?$/ }).max(2000),
        }),
      )
      .max(20),
    videoLinks: z
      .array(
        z
          .url({ protocol: /^https$/ })
          .max(2000)
          .refine((value) => {
            const host = new URL(value).hostname.toLowerCase();
            return [
              "youtube.com",
              "www.youtube.com",
              "youtu.be",
              "vimeo.com",
              "www.vimeo.com",
            ].includes(host);
          }, "Use an approved YouTube or Vimeo video link."),
      )
      .max(10),
    milestones: z
      .array(
        z.object({
          title: text(200).min(1),
          description: text(2000),
          date,
          achieved: z.boolean(),
        }),
      )
      .max(50),
    attachments: z.array(attachmentRefSchema).max(50),
  })
  .strict();
const money = z.union([
  z.literal(""),
  z
    .string()
    .regex(
      /^\d{1,12}(\.\d{1,2})?$/,
      "Enter a non-negative amount with at most two decimal places.",
    ),
]);
export const financialsSchema = z
  .object({
    budget: money,
    expenditure: money,
    fundingSource: text(2000),
    currency: z.literal("GHS"),
    internalNotes: text(5000),
  })
  .strict();
export const saveSchema = z
  .object({
    payload: payloadSchema,
    financials: financialsSchema,
    lockVersion: z.number().int().min(0),
  })
  .strict();
export function publicationErrors(
  kind: ContentKind,
  payload: ContentPayload,
  hasPreviousPublication: boolean,
) {
  const errors: string[] = [];
  if (payload.description.length < 20)
    errors.push("Add a description of at least 20 characters.");
  if (!payload.source) errors.push("Identify the source of the information.");
  if (!payload.reportingOffice)
    errors.push("Identify the authorised reporting office.");
  if ((payload.latitude === null) !== (payload.longitude === null))
    errors.push("Provide both GPS coordinates, or leave both blank.");
  if (hasPreviousPublication && payload.changeSummary.length < 10)
    errors.push("Explain the changes to the published record.");
  if (kind === "project") {
    if (!payload.categoryId || !payload.communityId)
      errors.push("Select an approved category and community.");
    if (!payload.objectives) errors.push("Describe the project's objectives.");
    if (!payload.progressExplanation)
      errors.push(
        "Explain how progress is measured, including for planned work.",
      );
    if (
      ["Delayed", "Suspended", "Cancelled"].includes(payload.status) &&
      !payload.delayReason
    )
      errors.push("Explain the delay, suspension, or cancellation.");
    if (
      payload.startDate &&
      payload.expectedCompletionDate &&
      payload.expectedCompletionDate < payload.startDate
    )
      errors.push("Expected completion cannot precede the start date.");
    if (
      payload.startDate &&
      payload.actualCompletionDate &&
      payload.actualCompletionDate < payload.startDate
    )
      errors.push("Actual completion cannot precede the start date.");
    if (payload.status === "Completed") {
      if (
        payload.progress !== 100 ||
        !payload.actualCompletionDate ||
        payload.completionSummary.length < 10 ||
        !payload.attachments.some((a) => a.purpose === "evidence")
      )
        errors.push(
          "Completion requires 100% progress, an actual completion date, a completion summary, and at least one evidence attachment.",
        );
      if (payload.actualCompletionDate > new Date().toISOString().slice(0, 10))
        errors.push("Actual completion cannot be in the future.");
    }
  }
  if (
    kind === "report" &&
    !payload.attachments.some(
      (a) => a.visibility === "public" && a.purpose !== "financial",
    )
  )
    errors.push("A public report needs a public document attachment.");
  return errors;
}
