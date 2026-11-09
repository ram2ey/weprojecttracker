import { staffApi, jsonBody, limitedBytes } from "@/lib/content/api";
import { changeNews } from "@/lib/news/service";
import { ContentError } from "@/lib/content/service";
import { canSubmit } from "@/lib/security/policy";
import { consumeLimit } from "@/lib/security/rate-limit";
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;"))
      return changeNews(actor, await jsonBody(request));
    if (!canSubmit(actor.role))
      throw new ContentError(403, "Editor access required.");
    if (!(await consumeLimit("uploads:" + actor.id, 30, 3600)))
      throw new ContentError(429, "Upload limit reached. Try again later.");
    const bytes = await limitedBytes(request, 10 * 1024 * 1024 + 64 * 1024);
    let form: FormData, data: unknown;
    try {
      form = await new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": type },
      }).formData();
      data = JSON.parse(String(form.get("story")));
    } catch {
      throw new ContentError(400, "Invalid story upload.");
    }
    const photo = form.get("photo");
    if (!(photo instanceof File) || form.getAll("photo").length !== 1)
      throw new ContentError(400, "Choose one photo.");
    return changeNews(actor, data, photo);
  });
}
