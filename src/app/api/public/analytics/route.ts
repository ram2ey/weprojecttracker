import { analyticsPath, readConsent } from "@/lib/analytics-policy";
import { getPool } from "@/db";
import { getIdentity } from "@/lib/security/staff-session";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (
    !checkOrigin(request) ||
    request.headers.get("sec-gpc") === "1" ||
    readConsent(request.headers.get("cookie") || "") !== "accepted"
  )
    return privateJson({ message: "Analytics permission is required." }, 403);
  const body = await smallJson(request, 512);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => k !== "path")
  )
    return privateJson({ message: "Invalid page view." }, 400);
  const path = analyticsPath("path" in body ? body.path : undefined);
  if (!path) return privateJson({ message: "Invalid page view." }, 400);
  try {
    if (await getIdentity(request.headers))
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    // A single shared abuse-control bucket avoids storing visitor fingerprints.
    if (!(await consumeLimit("analytics-global", 300, 60)))
      return privateJson({ message: "Please try again later." }, 429);
    if (path.startsWith("/projects/")) {
      const published = await getPool().query(
        `SELECT 1 FROM content_record r JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id
         WHERE r.slug=$1 AND r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' LIMIT 1`,
        [path.slice(10)],
      );
      if (!published.rowCount)
        return privateJson({ message: "Invalid page view." }, 400);
    }
    await getPool().query(
      `WITH expired AS (
      DELETE FROM analytics_daily WHERE day < (NOW() AT TIME ZONE 'UTC')::date - 89
    ) INSERT INTO analytics_daily (day,path,views) VALUES ((NOW() AT TIME ZONE 'UTC')::date,$1,1)
      ON CONFLICT (day,path) DO UPDATE SET views=LEAST(analytics_daily.views+1,1000000000)`,
      [path],
    );
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return privateJson(
      { message: "Statistics are temporarily unavailable." },
      503,
    );
  }
}
