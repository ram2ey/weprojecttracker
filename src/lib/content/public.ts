import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contentRecord, contentRevision, mediaFile } from "@/db/schema";
import { recordCode } from "./service";
import type { ContentPayload, PublicContent } from "./types";
import type { PublicFilters } from "./filters";

// Deliberate allowlist. Financials, internal notes, reviewer identities/reasons,
// storage keys and internal attachments never enter a public response.
export function publicPayload(
  p: ContentPayload,
  availableFiles: Set<string>,
): ContentPayload {
  return {
    title: p.title,
    description: p.description,
    objectives: p.objectives,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    subcategoryId: p.subcategoryId,
    subcategoryName: p.subcategoryName,
    communityId: p.communityId,
    communityName: p.communityName,
    region: p.region,
    district: p.district,
    constituency: p.constituency,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status,
    progress: p.progress,
    progressExplanation: p.progressExplanation,
    startDate: p.startDate,
    expectedCompletionDate: p.expectedCompletionDate,
    actualCompletionDate: p.actualCompletionDate,
    completionSummary: p.completionSummary,
    changeSummary: p.changeSummary,
    delayReason: p.delayReason,
    nextSteps: p.nextSteps,
    source: p.source,
    responsibleOrganisation: p.responsibleOrganisation,
    reportingOffice: p.reportingOffice,
    verificationNotes: p.verificationNotes,
    tags: p.tags,
    references: p.references.map((r) => ({ label: r.label, url: r.url })),
    videoLinks: p.videoLinks,
    milestones: p.milestones.map((m) => ({
      title: m.title,
      description: m.description,
      date: m.date,
      achieved: m.achieved,
    })),
    attachments: p.attachments
      .filter(
        (a) =>
          a.visibility === "public" &&
          a.purpose !== "financial" &&
          availableFiles.has(a.id),
      )
      .map((a) => ({
        id: a.id,
        caption: a.caption,
        capturedOn: a.capturedOn,
        visibility: "public",
        purpose: "evidence",
      })),
  };
}
export const livePublication = and(
  sql`NOT EXISTS (SELECT 1 FROM report_source rs JOIN content_record sr ON sr.id=rs.source_record_id WHERE rs.report_record_id=${contentRecord.id} AND (sr.withdrawn_at IS NOT NULL OR sr.published_revision_id IS NULL))`,
  isNotNull(contentRecord.publishedRevisionId),
  isNull(contentRecord.withdrawnAt),
  eq(contentRevision.state, "approved"),
  eq(contentRevision.recordId, contentRecord.id),
);
export type PublicSearch = Partial<PublicFilters> & { limit?: number };
export function publicConditions(filters: PublicSearch) {
  const search = filters.q?.trim().toLowerCase();
  return and(
    livePublication,
    filters.kind ? eq(contentRecord.kind, filters.kind) : undefined,
    search
      ? sql`position(${search} in lower(concat_ws(' ', ${contentRecord.number}::text, ${contentRevision.payload}->>'title', ${contentRevision.payload}->>'description', ${contentRevision.payload}->>'communityName', ${contentRevision.payload}->'tags'))) > 0`
      : undefined,
    ...(
      [
        ["category", "categoryName"],
        ["subcategory", "subcategoryName"],
        ["community", "communityName"],
        ["status", "status"],
      ] as const
    ).map(([filter, key]) =>
      filters[filter]
        ? sql`${contentRevision.payload}->>${key} = ${filters[filter]}`
        : undefined,
    ),
    filters.from
      ? sql`${contentRevision.decidedAt} >= ${filters.from}::date`
      : undefined,
    filters.to
      ? sql`${contentRevision.decidedAt} < (${filters.to}::date + interval '1 day')`
      : undefined,
  );
}
export async function listPublicContent(filters: PublicSearch = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
  const where = publicConditions(filters);
  const order =
    filters.sort === "oldest"
      ? contentRevision.decidedAt
      : filters.sort === "title"
        ? sql`lower(${contentRevision.payload}->>'title')`
        : filters.sort === "progress"
          ? sql`(${contentRevision.payload}->>'progress')::int DESC`
          : desc(contentRevision.decidedAt);
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: contentRecord.id,
        number: contentRecord.number,
        slug: contentRecord.slug,
        kind: contentRecord.kind,
        revisionId: contentRevision.id,
        payload: contentRevision.payload,
        publishedAt: contentRevision.decidedAt,
      })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRevision.id, contentRecord.publishedRevisionId),
      )
      .where(where)
      .orderBy(order, contentRecord.id)
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentRecord)
      .innerJoin(
        contentRevision,
        eq(contentRevision.id, contentRecord.publishedRevisionId),
      )
      .where(where),
  ]);
  const ids = rows.flatMap((r) => r.payload.attachments.map((a) => a.id));
  const available = ids.length
    ? await db
        .select({ id: mediaFile.id })
        .from(mediaFile)
        .where(
          and(
            inArray(mediaFile.id, ids),
            isNull(mediaFile.withdrawnAt),
            eq(mediaFile.internalOnly, false),
          ),
        )
    : [];
  const allowed = new Set(available.map((f) => f.id));
  const items: PublicContent[] = rows.map((r) => ({
    id: r.id,
    code: recordCode(r.kind, r.number),
    kind: r.kind,
    slug: r.slug,
    revisionId: r.revisionId,
    publishedAt: r.publishedAt!.toISOString(),
    payload: publicPayload(r.payload, allowed),
    history: [],
  }));
  return { items, page, limit, total: totals[0].count };
}
export const getPublicContent = cache(async function getPublicContent(
  slug: string,
): Promise<PublicContent | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: contentRecord.id,
      number: contentRecord.number,
      slug: contentRecord.slug,
      kind: contentRecord.kind,
      revisionId: contentRevision.id,
      revisionNumber: contentRevision.number,
      payload: contentRevision.payload,
      publishedAt: contentRevision.decidedAt,
    })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRevision.id, contentRecord.publishedRevisionId),
    )
    .where(and(livePublication, eq(contentRecord.slug, slug)))
    .limit(1);
  if (!row) return null;
  const history = await db
    .select({
      number: contentRevision.number,
      payload: contentRevision.payload,
      publishedAt: contentRevision.decidedAt,
    })
    .from(contentRevision)
    .where(
      and(
        eq(contentRevision.recordId, row.id),
        eq(contentRevision.state, "approved"),
        sql`${contentRevision.number} <= ${row.revisionNumber}`,
      ),
    )
    .orderBy(desc(contentRevision.number));
  const ids = history.flatMap((r) => r.payload.attachments.map((a) => a.id));
  const files = ids.length
    ? await db
        .select({ id: mediaFile.id })
        .from(mediaFile)
        .where(
          and(
            inArray(mediaFile.id, ids),
            eq(mediaFile.recordId, row.id),
            isNull(mediaFile.withdrawnAt),
            eq(mediaFile.internalOnly, false),
          ),
        )
    : [];
  const allowed = new Set(files.map((f) => f.id));
  return {
    id: row.id,
    code: recordCode(row.kind, row.number),
    kind: row.kind,
    slug: row.slug,
    revisionId: row.revisionId,
    publishedAt: row.publishedAt!.toISOString(),
    payload: publicPayload(row.payload, allowed),
    history: history.map((r) => ({
      number: r.number,
      publishedAt: r.publishedAt!.toISOString(),
      payload: publicPayload(r.payload, allowed),
    })),
  };
});
