import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { reviewReply } from "@/lib/engagement/service";
import { moderationSchema } from "@/lib/engagement/validation";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    return reviewReply(
      actor,
      id,
      moderationSchema.parse(await jsonBody(request)),
    );
  });
}
