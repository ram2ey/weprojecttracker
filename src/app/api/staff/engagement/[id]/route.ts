import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { moderate, prepareReply } from "@/lib/engagement/service";
import { moderationSchema, replySchema } from "@/lib/engagement/validation";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    const body = await jsonBody(request);
    if (body && typeof body === "object" && body.action === "respond") {
      const input = z
        .object({ action: z.literal("respond"), body: replySchema.shape.body })
        .strict()
        .parse(body);
      return prepareReply(actor, id, input.body);
    }
    return moderate(actor, id, moderationSchema.parse(body));
  });
}
