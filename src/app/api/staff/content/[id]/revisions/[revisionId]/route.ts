import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { saveSchema } from "@/lib/content/validation";
import {
  saveRevision,
  submitRevision,
  decideRevision,
} from "@/lib/content/service";
type Context = { params: Promise<{ id: string; revisionId: string }> };
export async function PATCH(request: Request, context: Context) {
  const { id, revisionId } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    z.uuid().parse(revisionId);
    return saveRevision(
      actor,
      id,
      revisionId,
      saveSchema.parse(await jsonBody(request)),
    );
  });
}
export async function POST(request: Request, context: Context) {
  const { id, revisionId } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    z.uuid().parse(revisionId);
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("submit"),
            lockVersion: z.number().int().min(0),
          })
          .strict(),
        z
          .object({
            action: z.literal("approve"),
            // Optional note; the evidence confirmation is the real gate.
            reason: z.string().trim().max(2000).default(""),
            evidenceReviewed: z.boolean().default(false),
            lockVersion: z.number().int().min(0),
          })
          .strict(),
        z
          .object({
            action: z.literal("return"),
            // The author needs to know what to correct.
            reason: z.string().trim().min(10).max(2000),
            evidenceReviewed: z.boolean().default(false),
            lockVersion: z.number().int().min(0),
          })
          .strict(),
      ])
      .parse(await jsonBody(request));
    if (input.action === "submit")
      return submitRevision(actor, id, revisionId, input.lockVersion);
    return decideRevision(actor, id, revisionId, input);
  });
}
