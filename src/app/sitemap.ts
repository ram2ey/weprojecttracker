import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contentRecord, contentRevision } from "@/db/schema";
import { livePublication } from "@/lib/content/public";
import { siteUrl } from "@/lib/site";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const records = await getDb()
    .select({ slug: contentRecord.slug, updated: contentRevision.decidedAt })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRevision.id, contentRecord.publishedRevisionId),
    )
    .where(livePublication)
    .orderBy(contentRecord.id)
    .limit(49000);
  return [
    { url: siteUrl() },
    { url: siteUrl() + "/projects" },
    { url: siteUrl() + "/about" },
    { url: siteUrl() + "/contact" },
    { url: siteUrl() + "/faq" },
    { url: siteUrl() + "/privacy" },
    ...records.map((r) => ({
      url: siteUrl() + "/projects/" + r.slug,
      lastModified: r.updated!,
    })),
  ];
}
