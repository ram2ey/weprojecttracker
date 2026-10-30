import { z } from "zod";
import { staffApi, limitedBytes } from "@/lib/content/api";
import { ContentError } from "@/lib/content/service";
import { storeEvidence } from "@/lib/content/media";
import { consumeLimit } from "@/lib/security/rate-limit";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return staffApi(request, async (actor) => {
    z.uuid().parse(id);
    if (!(await consumeLimit(`uploads:${actor.id}`, 30, 3600)))
      throw new ContentError(429, "Upload limit reached. Try again later.");
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;"))
      throw new ContentError(400, "Use a multipart file upload.");
    const bytes = await limitedBytes(request, 21 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": type },
      body: new Uint8Array(bytes),
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1)
      throw new ContentError(400, "Upload one file per request.");
    return storeEvidence(actor, id, file, form.get("internalOnly") === "true");
  });
}
