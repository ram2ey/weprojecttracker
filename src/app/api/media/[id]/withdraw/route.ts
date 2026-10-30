import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { withdrawEvidence } from "@/lib/content/media";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    const { reason } = z
      .object({ reason: z.string().trim().min(10).max(2000) })
      .parse(await jsonBody(request));
    return withdrawEvidence(actor, id, reason);
  });
}
