import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaFile } from "@/db/schema";
import { getIdentity } from "@/lib/security/staff-session";
import { isPublicEvidence, mediaPath } from "@/lib/content/media";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const identity = await getIdentity(request.headers);
  if (!identity?.verified && !(await isPublicEvidence(id)))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const file = await getDb().query.mediaFile.findFirst({
    where: eq(mediaFile.id, id),
  });
  if (!file) return new Response(null, { status: 404 });
  const thumbnail =
    new URL(request.url).searchParams.get("variant") === "thumbnail";
  const key = thumbnail ? file.thumbnailKey : file.storageKey;
  if (!key) return new Response(null, { status: 404 });
  try {
    const path = mediaPath(key);
    const info = await stat(path);
    const pdf = file.mimeType === "application/pdf";
    const filename = pdf
      ? file.originalName
      : file.originalName.replace(/\.[^.]+$/, "") + ".webp";
    return new Response(
      Readable.toWeb(createReadStream(path)) as ReadableStream,
      {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Length": String(info.size),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
          "Content-Disposition": `${pdf ? "attachment" : "inline"}; filename="evidence.${pdf ? "pdf" : "webp"}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      },
    );
  } catch {
    return new Response(null, { status: 404 });
  }
}
