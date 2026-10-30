import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentRecord, contentRevision } from "@/db/schema";
import { livePublication } from "@/lib/content/public";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const records = await getDb()
    .select({
      slug: contentRecord.slug,
      kind: contentRecord.kind,
      updated: contentRevision.decidedAt,
    })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRecord.publishedRevisionId, contentRevision.id),
    )
    .where(livePublication)
    .orderBy(contentRecord.id)
    .limit(49000);
  const base = siteUrl();
  return [
    ...[
      "",
      "/projects",
      "/updates",
      "/announcements",
      "/reports",
      "/about",
    ].map((path) => ({ url: base + path })),
    ...records.map((r) => ({
      url: `${base}/${r.kind === "project" ? "projects" : "information"}/${r.slug}`,
      lastModified: r.updated!,
    })),
  ];
}
