import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaFile } from "@/db/schema";
import { isPublicEvidence, mediaPath } from "@/lib/content/media";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!/^[a-f0-9-]{36}$/i.test(id) || !(await isPublicEvidence(id)))
    return new Response(null, { status: 404, headers });
  const file = await getDb().query.mediaFile.findFirst({
    where: eq(mediaFile.id, id),
  });
  if (!file?.thumbnailKey || file.mimeType !== "image/webp")
    return new Response(null, { status: 404, headers });
  try {
    return new Response(await readFile(mediaPath(file.thumbnailKey)), {
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "X-Public-Cache": "public-thumbnail-v1",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
