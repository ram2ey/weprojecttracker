import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import {
  createRevision,
  discardDraft,
  getAdminRecord,
  withdrawRecord,
} from "@/lib/content/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return staffApi(request, async () => getAdminRecord(z.uuid().parse(id)));
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    const input = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("revise"),
          sourceRevisionId: z.uuid().optional(),
        }),
        z.object({
          action: z.literal("withdraw"),
          reason: z.string().trim().min(10).max(2000),
        }),
        z.object({
          action: z.literal("discard"),
          revisionId: z.uuid(),
          lockVersion: z.number().int().min(0),
          reason: z.string().trim().min(10).max(2000),
        }),
      ])
      .parse(await jsonBody(request));
    if (input.action === "withdraw")
      return withdrawRecord(actor, id, input.reason);
    if (input.action === "discard")
      return discardDraft(
        actor,
        id,
        input.revisionId,
        input.lockVersion,
        input.reason,
      );
    return createRevision(actor, id, input.sourceRevisionId);
  });
}
