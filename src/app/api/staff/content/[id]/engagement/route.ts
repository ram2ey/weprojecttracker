import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { updateEngagementSettings } from "@/lib/engagement/service";
import { settingsSchema } from "@/lib/engagement/validation";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    return updateEngagementSettings(
      actor,
      id,
      settingsSchema.parse(await jsonBody(request)),
    );
  });
}
