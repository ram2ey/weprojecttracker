import { z } from "zod";
import { getPool } from "@/db";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = z
    .array(z.uuid())
    .max(200)
    .safeParse(
      params.has("ids") ? params.get("ids")!.split(",").filter(Boolean) : [],
    );
  if (!parsed.success)
    return Response.json(
      { message: "Invalid project selection." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const result = await getPool().query(
    "SELECT r.id,r.slug,v.id AS revision_id,v.payload->>'title' AS title,v.payload->>'communityName' AS community,v.payload->>'status' AS status,(v.payload->>'progress')::int AS progress,left(v.payload->>'changeSummary',240) AS summary,v.decided_at AS published_at FROM content_record r JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id WHERE r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' AND ($1::text[] IS NULL OR r.id=ANY($1::text[])) ORDER BY v.decided_at DESC,r.id LIMIT 200",
    [params.has("ids") ? parsed.data : null],
  );
  return Response.json(
    { items: result.rows },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Public-Cache": "public-feed-v1",
      },
    },
  );
}
