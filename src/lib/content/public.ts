import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentRecord, contentRevision, mediaFile } from "@/db/schema";
import { launchPayload } from "./validation";
import type { ContentPayload, PublicContent } from "./types";
import type { PublicFilters } from "./filters";
export const livePublication = and(
  eq(contentRecord.kind, "project"),
  isNull(contentRecord.withdrawnAt),
  eq(contentRevision.state, "approved"),
  eq(contentRevision.recordId, contentRecord.id),
);
async function projectView(r: {
  id: string;
  slug: string;
  revisionId: string;
  payload: ContentPayload;
  publishedAt: Date | null;
}): Promise<PublicContent> {
  const ids = r.payload.attachments
    .filter((a) => a.visibility === "public" && a.purpose !== "financial")
    .map((a) => a.id);
  const files = ids.length
    ? await getDb()
        .select({ id: mediaFile.id })
        .from(mediaFile)
        .where(
          and(
            inArray(mediaFile.id, ids),
            eq(mediaFile.recordId, r.id),
            isNull(mediaFile.withdrawnAt),
            eq(mediaFile.internalOnly, false),
            sql`${mediaFile.mimeType} LIKE 'image/%'`,
          ),
        )
    : [];
  return {
    id: r.id,
    kind: "project",
    slug: r.slug,
    revisionId: r.revisionId,
    publishedAt: r.publishedAt!.toISOString(),
    payload: launchPayload(r.payload, new Set(files.map((f) => f.id))),
  };
}
const selection = {
  id: contentRecord.id,
  slug: contentRecord.slug,
  revisionId: contentRevision.id,
  payload: contentRevision.payload,
  publishedAt: contentRevision.decidedAt,
};
export async function listPublicContent(filters: Partial<PublicFilters> = {}) {
  const db = getDb(),
    page = filters.page ?? 1,
    q = filters.q?.toLowerCase();
  const where = and(
    livePublication,
    q
      ? sql`position(${q} in lower(concat_ws(' ',${contentRevision.payload}->>'title',${contentRevision.payload}->>'communityName')))>0`
      : undefined,
    ...(
      [
        ["category", "categoryName"],
        ["community", "communityName"],
        ["status", "status"],
      ] as const
    ).map(([f, k]) =>
      filters[f]
        ? sql`${contentRevision.payload}->>${k}=${filters[f]}`
        : undefined,
    ),
  );
  const [rows, count] = await Promise.all([
    db
      .select(selection)
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRevision.id, contentRecord.publishedRevisionId),
      )
      .where(where)
      .orderBy(desc(contentRevision.decidedAt), contentRecord.id)
      .limit(24)
      .offset((page - 1) * 24),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRevision.id, contentRecord.publishedRevisionId),
      )
      .where(where),
  ]);
  return {
    items: await Promise.all(rows.map(projectView)),
    page,
    limit: 24,
    total: count[0].count,
  };
}
export const getPublicContent = cache(async (slug: string) => {
  const [r] = await getDb()
    .select(selection)
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRevision.id, contentRecord.publishedRevisionId),
    )
    .where(and(livePublication, eq(contentRecord.slug, slug)))
    .limit(1);
  return r ? projectView(r) : null;
});
export async function publicCommunities() {
  const name = sql<string>`${contentRevision.payload}->>'communityName'`;
  return getDb()
    .select({ name, count: sql<number>`count(*)::int` })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRevision.id, contentRecord.publishedRevisionId),
    )
    .where(and(livePublication, sql`${name} <> ''`))
    .groupBy(name)
    .orderBy(name);
}
