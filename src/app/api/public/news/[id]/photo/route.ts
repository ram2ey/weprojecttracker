import { publishedPhoto } from "@/lib/news/service";
type Context = { params: Promise<{ id: string }> };
// Serves a published news photo. Addresses carry a content hash (?v=), so a
// matching request can be cached for a year; anything else gets a short cache.
export async function GET(request: Request, context: Context) {
  const photo = await publishedPhoto((await context.params).id).catch(
    () => null,
  );
  if (!photo)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const current = new URL(request.url).searchParams.get("v") === photo.hash;
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(photo.bytes.length),
      "Cache-Control": current
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300",
      ETag: `"${photo.hash}"`,
    },
  });
}
