import { z } from "zod";
import {
  projectStatuses,
  type LaunchPayload,
  type ContentPayload,
} from "./types";
export const fixedCategories = [
  { id: "category-education", name: "Education" },
  { id: "category-health", name: "Health" },
  { id: "category-general", name: "General" },
  { id: "category-community", name: "Community Development" },
  { id: "category-social", name: "Social Amenities" },
] as const;
export const payloadSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(15000),
    categoryId: z.string().max(100),
    communityId: z.string().max(100),
    status: z.enum(projectStatuses),
    source: z.string().trim().max(2000),
    actualCompletionDate: z.union([z.literal(""), z.iso.date()]),
    completionSummary: z.string().trim().max(4000),
    attachments: z
      .array(
        z
          .object({ id: z.uuid(), caption: z.string().trim().max(500) })
          .strict(),
      )
      .max(50),
  })
  .strict();
export const saveSchema = z
  .object({ payload: payloadSchema, lockVersion: z.number().int().min(0) })
  .strict();
export function launchPayload(
  p: ContentPayload,
  allowed?: Set<string>,
): LaunchPayload {
  return {
    title: p.title,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    communityId: p.communityId,
    communityName: p.communityName,
    status: p.status,
    source: p.source,
    actualCompletionDate: p.actualCompletionDate,
    completionSummary: p.completionSummary,
    attachments: p.attachments
      .filter(
        (a) =>
          a.visibility === "public" &&
          a.purpose !== "financial" &&
          (!allowed || allowed.has(a.id)),
      )
      .map((a) => ({ id: a.id, caption: a.caption })),
  };
}
export function publicationErrors(p: LaunchPayload) {
  const errors: string[] = [];
  if (p.title.trim().length < 3) errors.push("Add a title.");
  if (p.description.trim().length < 20)
    errors.push("Add a description of at least 20 characters.");
  if (!p.categoryId || !p.communityId)
    errors.push("Choose a category and community.");
  if (!p.source.trim()) errors.push("Identify the information source.");
  if (p.status === "Completed") {
    if (
      !p.actualCompletionDate ||
      p.completionSummary.trim().length < 10 ||
      !p.attachments.length
    )
      errors.push(
        "Completed projects need a completion date, summary of at least 10 characters and a photograph.",
      );
    if (p.actualCompletionDate > new Date().toISOString().slice(0, 10))
      errors.push("Completion cannot be in the future.");
  }
  return errors;
}
