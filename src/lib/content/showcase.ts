import "server-only";
import { cache } from "react";
import { getDb } from "@/db";
import { contentRecord } from "@/db/schema";
import { isDesignPreview } from "@/lib/env";
import { publicProjects, categories, type PublicProject } from "@/lib/projects";
import { listPublicContent } from "./public";
import type { PublicContent } from "./types";
import { discoverySummary } from "./discovery";
export function projectCardData(record: PublicContent): PublicProject {
  const image = record.payload.attachments.find(
    (a) => a.visibility === "public",
  );
  return {
    id: record.code,
    slug: record.slug,
    title: record.payload.title,
    category: record.payload.categoryName,
    community: record.payload.communityName,
    status: record.payload.status,
    progress: record.payload.progress,
    description: record.payload.description,
    image:
      record.payload.categoryName === "Health"
        ? "clinic"
        : record.payload.categoryName === "Social Amenities"
          ? "water"
          : "school",
    updated: new Date(record.publishedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    coverUrl: image ? `/api/public/thumbnails/${image.id}` : undefined,
  };
}
export async function projectCards(
  records: PublicContent[],
): Promise<PublicProject[]> {
  const ids = records.flatMap((r) => r.payload.attachments.map((a) => a.id));
  const files = ids.length
    ? await getDb().query.mediaFile.findMany({
        where: (m, { inArray, and, like }) =>
          and(inArray(m.id, ids), like(m.mimeType, "image/%")),
        columns: { id: true },
      })
    : [];
  const images = new Set(files.map((f) => f.id));
  return records.map((r) =>
    projectCardData({
      ...r,
      payload: {
        ...r.payload,
        attachments: r.payload.attachments.filter((a) => images.has(a.id)),
      },
    }),
  );
}
export const isSampleDataset = cache(async () => {
  if (!isDesignPreview()) return false;
  const db = getDb();
  const [any] = await db
    .select({ id: contentRecord.id })
    .from(contentRecord)
    .limit(1);
  return !any;
});
export const publicDataset = cache(async () => {
  if (await isSampleDataset()) {
    const projects = publicProjects();
    return {
      sample: true,
      projects,
      categories,
      categoryCounts: Object.fromEntries(
        categories.map((c) => [
          c,
          projects.filter((p) => p.category === c).length,
        ]),
      ),
      stats: {
        total: projects.length,
        ongoing: projects.filter((p) => p.status === "Ongoing").length,
        completed: projects.filter((p) => p.status === "Completed").length,
      },
    };
  }
  const [listing, summary] = await Promise.all([
    listPublicContent({ kind: "project", limit: 4 }),
    discoverySummary(),
  ]);
  return {
    sample: false,
    projects: await projectCards(listing.items),
    categories: summary.categories,
    categoryCounts: summary.categoryCounts,
    stats: summary.stats,
  };
});
