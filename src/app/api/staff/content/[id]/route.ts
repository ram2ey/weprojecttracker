import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import {
  createRevision,
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
        z
          .object({
            action: z.literal("revise"),
            sourceRevisionId: z.uuid().optional(),
          })
          .strict(),
        z
          .object({
            action: z.literal("withdraw"),
            reason: z.string().trim().min(10).max(2000),
          })
          .strict(),
      ])
      .parse(await jsonBody(request));
    return input.action === "withdraw"
      ? withdrawRecord(actor, id, input.reason)
      : createRevision(actor, id, input.sourceRevisionId);
  });
}
