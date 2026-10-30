import "server-only";
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentRecord, contentRevision, taxonomy } from "@/db/schema";
import { livePublication, publicConditions, type PublicSearch } from "./public";
import type { FeatureCollection, Point } from "geojson";
export type MapProperties = {
  slug: string;
  title: string;
  code: string;
  category: string;
  community: string;
  status: string;
  progress: number;
};
export type ProjectMapData = {
  geojson: FeatureCollection<Point, MapProperties>;
  total: number;
  located: number;
  shown: number;
  truncated: boolean;
};
const projectLive = and(livePublication, eq(contentRecord.kind, "project"));
export const discoverySummary = cache(async () => {
  const db = getDb();
  const [groups, totals, terms] = await Promise.all([
    db
      .select({
        category: sql<string>`${contentRevision.payload}->>'categoryName'`,
        subcategory: sql<string>`${contentRevision.payload}->>'subcategoryName'`,
        community: sql<string>`${contentRevision.payload}->>'communityName'`,
        count: sql<number>`count(*)::int`,
      })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRecord.publishedRevisionId, contentRevision.id),
      )
      .where(projectLive)
      .groupBy(
        sql`${contentRevision.payload}->>'categoryName'`,
        sql`${contentRevision.payload}->>'subcategoryName'`,
        sql`${contentRevision.payload}->>'communityName'`,
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        ongoing: sql<number>`count(*) filter (where ${contentRevision.payload}->>'status'='Ongoing')::int`,
        completed: sql<number>`count(*) filter (where ${contentRevision.payload}->>'status'='Completed')::int`,
      })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRecord.publishedRevisionId, contentRevision.id),
      )
      .where(projectLive),
    db
      .select({ name: taxonomy.name })
      .from(taxonomy)
      .where(and(eq(taxonomy.kind, "category"), eq(taxonomy.active, true))),
  ]);
  const categories = [
    ...new Set([...terms.map((t) => t.name), ...groups.map((g) => g.category)]),
  ]
    .filter(Boolean)
    .sort();
  return {
    categories,
    subcategories: [...new Set(groups.map((g) => g.subcategory))]
      .filter(Boolean)
      .sort(),
    communities: [...new Set(groups.map((g) => g.community))]
      .filter(Boolean)
      .sort(),
    categoryCounts: Object.fromEntries(
      categories.map((name) => [
        name,
        groups
          .filter((g) => g.category === name)
          .reduce((n, g) => n + g.count, 0),
      ]),
    ),
    stats: totals[0],
  };
});
export async function publicProjectMap(
  filters: PublicSearch,
): Promise<ProjectMapData> {
  const db = getDb(),
    where = publicConditions({ ...filters, kind: "project" });
  const hasLocation = sql`${contentRevision.payload}->>'latitude' IS NOT NULL AND ${contentRevision.payload}->>'longitude' IS NOT NULL`;
  const [rows, counts] = await Promise.all([
    db
      .select({
        slug: contentRecord.slug,
        number: contentRecord.number,
        title: sql<string>`${contentRevision.payload}->>'title'`,
        category: sql<string>`${contentRevision.payload}->>'categoryName'`,
        community: sql<string>`${contentRevision.payload}->>'communityName'`,
        status: sql<string>`${contentRevision.payload}->>'status'`,
        progress: sql<number>`(${contentRevision.payload}->>'progress')::int`,
        latitude: sql<number>`(${contentRevision.payload}->>'latitude')::float`,
        longitude: sql<number>`(${contentRevision.payload}->>'longitude')::float`,
      })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRecord.publishedRevisionId, contentRevision.id),
      )
      .where(and(where, hasLocation))
      .orderBy(contentRecord.id)
      .limit(1000),
    db
      .select({
        total: sql<number>`count(*)::int`,
        located: sql<number>`count(*) filter (where ${hasLocation})::int`,
      })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRecord.publishedRevisionId, contentRevision.id),
      )
      .where(where),
  ]);
  return {
    ...counts[0],
    shown: rows.length,
    truncated: counts[0].located > rows.length,
    geojson: {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.longitude, r.latitude] },
        properties: {
          slug: r.slug,
          title: r.title,
          code: `WE-P${String(r.number).padStart(5, "0")}`,
          category: r.category,
          community: r.community,
          status: r.status,
          progress: r.progress,
        },
      })),
    },
  };
}
