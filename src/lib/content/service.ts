import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLog,
  contentRecord,
  contentRevision,
  mediaFile,
  taxonomy,
} from "@/db/schema";
import { canApprove, canSubmit, type Role } from "@/lib/security/policy";
import {
  emptyPayload,
  emptyFinancials,
  type ContentKind,
  type ContentPayload,
  type Financials,
  type AdminRecord,
  type AdminRecordSummary,
} from "./types";
import { publicationErrors } from "./validation";
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export type Actor = { id: string; role: Role };
export class ContentError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function recordCode(kind: ContentKind, number: number) {
  return `WE-${{ project: "P", announcement: "A", report: "R" }[kind]}${String(number).padStart(5, "0")}`;
}
function mustSubmit(actor: Actor) {
  if (!canSubmit(actor.role))
    throw new ContentError(
      403,
      "Only project officers and operators can prepare submissions.",
    );
}
function mustReview(actor: Actor) {
  if (actor.role !== "approver" && actor.role !== "super_admin")
    throw new ContentError(403, "Approver access is required.");
}
async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  subjectId: string,
  details: Record<string, string> = {},
) {
  await tx.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    action,
    subjectId,
    details,
  });
}
async function lockedRecord(tx: Tx, id: string) {
  const [record] = await tx
    .select()
    .from(contentRecord)
    .where(eq(contentRecord.id, id))
    .for("update");
  if (!record) throw new ContentError(404, "Record not found.");
  return record;
}
async function revisionFor(tx: Tx, recordId: string, revisionId: string) {
  const [revision] = await tx
    .select()
    .from(contentRevision)
    .where(
      and(
        eq(contentRevision.id, revisionId),
        eq(contentRevision.recordId, recordId),
      ),
    );
  if (!revision) throw new ContentError(404, "Revision not found.");
  return revision;
}
async function taxonomySnapshot(
  tx: Tx,
  payload: ContentPayload,
  kind: ContentKind,
  required: boolean,
) {
  const next = {
    ...payload,
    categoryName: "",
    subcategoryName: "",
    communityName: "",
  };
  if (kind !== "project") return next;
  const ids = [
    payload.categoryId,
    payload.subcategoryId,
    payload.communityId,
  ].filter(Boolean);
  const terms = ids.length
    ? await tx.select().from(taxonomy).where(inArray(taxonomy.id, ids))
    : [];
  for (const [id, expected, field] of [
    [payload.categoryId, "category", "categoryName"],
    [payload.subcategoryId, "subcategory", "subcategoryName"],
    [payload.communityId, "community", "communityName"],
  ] as const) {
    if (!id) {
      if (required && expected !== "subcategory")
        throw new ContentError(
          400,
          "Select an approved category and community.",
        );
      continue;
    }
    const term = terms.find(
      (t) => t.id === id && t.kind === expected && t.active,
    );
    if (!term)
      throw new ContentError(
        400,
        "A selected category, subcategory, or community is inactive or invalid.",
      );
    if (expected === "subcategory" && term.parentId !== payload.categoryId)
      throw new ContentError(
        400,
        "The subcategory does not belong to the selected category.",
      );
    next[field] = term.name;
  }
  return next;
}
async function validateEvidence(
  tx: Tx,
  recordId: string,
  payload: ContentPayload,
  kind: ContentKind,
) {
  if (
    new Set(payload.attachments.map((a) => a.id)).size !==
    payload.attachments.length
  )
    throw new ContentError(400, "Each attachment may appear only once.");
  const files = payload.attachments.length
    ? await tx
        .select()
        .from(mediaFile)
        .where(
          inArray(
            mediaFile.id,
            payload.attachments.map((a) => a.id),
          ),
        )
    : [];
  for (const reference of payload.attachments) {
    const file = files.find(
      (f) => f.id === reference.id && f.recordId === recordId && !f.withdrawnAt,
    );
    if (!file)
      throw new ContentError(
        400,
        "An attachment is unavailable or belongs to another record.",
      );
    if (
      (file.internalOnly || reference.purpose === "financial") &&
      reference.visibility !== "internal"
    )
      throw new ContentError(400, "Financial evidence cannot be published.");
  }
  if (
    kind === "report" &&
    !payload.attachments.some(
      (a) =>
        a.visibility === "public" &&
        files.find((f) => f.id === a.id)?.mimeType === "application/pdf",
    )
  )
    throw new ContentError(
      400,
      "A public report must include a public PDF document.",
    );
}
export async function createRecord(
  actor: Actor,
  kind: ContentKind,
  title: string,
) {
  mustSubmit(actor);
  return getDb().transaction(async (tx) => {
    const id = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const stem =
      title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70) || kind;
    await tx.insert(contentRecord).values({
      id,
      kind,
      slug: `${stem}-${id.slice(0, 8)}`,
      createdBy: actor.id,
    });
    await tx.insert(contentRevision).values({
      id: revisionId,
      recordId: id,
      number: 1,
      baseVersion: 0,
      authorId: actor.id,
      contributors: [actor.id],
      payload: { ...emptyPayload, title },
      financials: emptyFinancials,
    });
    await audit(tx, actor, "content.created", id, { revisionId, kind });
    return { recordId: id, revisionId };
  });
}
export async function createRevision(
  actor: Actor,
  recordId: string,
  sourceId?: string,
) {
  mustSubmit(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, recordId);
    const revisions = await tx
      .select()
      .from(contentRevision)
      .where(eq(contentRevision.recordId, recordId))
      .orderBy(desc(contentRevision.number));
    if (revisions.some((r) => r.state === "draft" || r.state === "pending"))
      throw new ContentError(
        409,
        "This record already has a draft or pending revision. Open that revision instead.",
      );
    const source = sourceId
      ? revisions.find((r) => r.id === sourceId)
      : revisions[0];
    if (!source) throw new ContentError(404, "Source revision not found.");
    const revisionId = crypto.randomUUID();
    const available = source.payload.attachments.length
      ? await tx
          .select({ id: mediaFile.id })
          .from(mediaFile)
          .where(
            and(
              inArray(
                mediaFile.id,
                source.payload.attachments.map((a) => a.id),
              ),
              isNull(mediaFile.withdrawnAt),
            ),
          )
      : [];
    await tx.insert(contentRevision).values({
      id: revisionId,
      recordId,
      number: revisions[0].number + 1,
      baseVersion: record.version,
      authorId: actor.id,
      contributors: [actor.id],
      payload: {
        ...source.payload,
        changeSummary: "",
        attachments: source.payload.attachments.filter((a) =>
          available.some((f) => f.id === a.id),
        ),
      },
      financials: source.financials,
    });
    await audit(tx, actor, "content.revision_created", recordId, {
      revisionId,
      sourceId: source.id,
    });
    return { recordId, revisionId };
  });
}
export async function saveRevision(
  actor: Actor,
  recordId: string,
  revisionId: string,
  input: {
    payload: ContentPayload;
    financials: Financials;
    lockVersion: number;
  },
) {
  mustSubmit(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, recordId);
    const revision = await revisionFor(tx, recordId, revisionId);
    if (revision.state !== "draft")
      throw new ContentError(
        409,
        "Submitted revisions are immutable. Create a new draft to make corrections.",
      );
    if (revision.lockVersion !== input.lockVersion)
      throw new ContentError(
        409,
        "Another officer changed this draft. Reload before saving; your current changes have not been applied.",
      );
    const payload = await taxonomySnapshot(
      tx,
      input.payload,
      record.kind,
      false,
    );
    // Draft reports may be saved before their public PDF is attached.
    await validateEvidence(
      tx,
      recordId,
      payload,
      record.kind === "report" ? "announcement" : record.kind,
    );
    await tx
      .update(contentRevision)
      .set({
        payload,
        financials: input.financials,
        contributors: [...new Set([...revision.contributors, actor.id])],
        lockVersion: revision.lockVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(contentRevision.id, revisionId));
    await tx
      .update(contentRecord)
      .set({ updatedAt: new Date() })
      .where(eq(contentRecord.id, recordId));
    await audit(tx, actor, "content.draft_saved", recordId, {
      revisionId,
      lockVersion: String(revision.lockVersion + 1),
    });
    return { lockVersion: revision.lockVersion + 1 };
  });
}
export async function submitRevision(
  actor: Actor,
  recordId: string,
  revisionId: string,
  lockVersion: number,
) {
  mustSubmit(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, recordId);
    const revision = await revisionFor(tx, recordId, revisionId);
    if (revision.state !== "draft" || revision.lockVersion !== lockVersion)
      throw new ContentError(
        409,
        "This revision changed or has already been submitted. Reload it before continuing.",
      );
    if (revision.baseVersion !== record.version)
      throw new ContentError(
        409,
        "Publication changed while this draft was being prepared. Create a fresh revision from the current record.",
      );
    await taxonomySnapshot(tx, revision.payload, record.kind, true);
    const errors = publicationErrors(
      record.kind,
      revision.payload,
      Boolean(record.publishedRevisionId),
    );
    if (errors.length) throw new ContentError(400, errors.join(" "));
    await validateEvidence(tx, recordId, revision.payload, record.kind);
    await tx
      .update(contentRevision)
      .set({
        state: "pending",
        submittedBy: actor.id,
        submittedAt: new Date(),
        updatedAt: new Date(),
        lockVersion: revision.lockVersion + 1,
      })
      .where(eq(contentRevision.id, revisionId));
    await tx
      .update(contentRecord)
      .set({ updatedAt: new Date() })
      .where(eq(contentRecord.id, recordId));
    await audit(tx, actor, "content.submitted", recordId, { revisionId });
    return { state: "pending" };
  });
}
export async function decideRevision(
  actor: Actor,
  recordId: string,
  revisionId: string,
  input: {
    action: "approve" | "return" | "reject";
    reason: string;
    evidenceReviewed: boolean;
    lockVersion: number;
  },
) {
  mustReview(actor);
  return getDb().transaction(async (tx) => {
    // Lock report sources before the report itself, matching withdrawal's
    // source-then-derived-report order. A concurrent source withdrawal/update
    // must finish before the approval snapshot is checked.
    const [kind] = await tx
      .select({ kind: contentRecord.kind })
      .from(contentRecord)
      .where(eq(contentRecord.id, recordId));
    if (kind?.kind === "report")
      await tx.execute(
        sql`SELECT source.id FROM content_record source JOIN report_source rs ON rs.source_record_id=source.id WHERE rs.report_record_id=${recordId} ORDER BY source.id FOR SHARE OF source`,
      );
    const record = await lockedRecord(tx, recordId);
    const revision = await revisionFor(tx, recordId, revisionId);
    if (
      !canApprove(actor.role, actor.id, revision.authorId) ||
      revision.contributors.includes(actor.id) ||
      revision.submittedBy === actor.id
    )
      throw new ContentError(
        403,
        "A person who prepared or submitted this revision cannot review it.",
      );
    if (
      revision.state !== "pending" ||
      revision.lockVersion !== input.lockVersion
    )
      throw new ContentError(
        409,
        "This submission has already changed or been decided. Reload the review queue.",
      );
    const approved = input.action === "approve";
    if (approved) {
      if (record.kind === "report") {
        const stale = await tx.execute(
          sql`SELECT 1 FROM report_source rs JOIN content_record source ON source.id=rs.source_record_id WHERE rs.report_record_id=${recordId} AND (source.withdrawn_at IS NOT NULL OR source.published_revision_id IS DISTINCT FROM rs.source_revision_id) LIMIT 1`,
        );
        if (stale.rows.length)
          throw new ContentError(
            409,
            "A source project changed or was withdrawn. Generate a fresh public-report draft.",
          );
      }
      if (!input.evidenceReviewed)
        throw new ContentError(
          400,
          "Confirm that you checked attribution, completion details, and public evidence for internal financial information.",
        );
      if (revision.baseVersion !== record.version)
        throw new ContentError(
          409,
          "The published record was changed or withdrawn after submission. Return this revision and prepare a fresh draft.",
        );
      await taxonomySnapshot(tx, revision.payload, record.kind, true);
      const errors = publicationErrors(
        record.kind,
        revision.payload,
        Boolean(record.publishedRevisionId),
      );
      if (errors.length) throw new ContentError(400, errors.join(" "));
      await validateEvidence(tx, recordId, revision.payload, record.kind);
      await tx
        .update(contentRecord)
        .set({
          publishedRevisionId: revisionId,
          version: record.version + 1,
          withdrawnAt: null,
          withdrawalReason: null,
          updatedAt: new Date(),
        })
        .where(eq(contentRecord.id, recordId));
    }
    const state = approved
      ? "approved"
      : input.action === "return"
        ? "returned"
        : "rejected";
    await tx
      .update(contentRevision)
      .set({
        state,
        decidedBy: actor.id,
        decidedAt: new Date(),
        decisionReason: input.reason,
        updatedAt: new Date(),
        lockVersion: revision.lockVersion + 1,
      })
      .where(eq(contentRevision.id, revisionId));
    await audit(tx, actor, `content.${state}`, recordId, {
      revisionId,
      reason: input.reason,
    });
    return { state };
  });
}
export async function withdrawRecord(
  actor: Actor,
  recordId: string,
  reason: string,
) {
  mustReview(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, recordId);
    if (!record.publishedRevisionId || record.withdrawnAt)
      throw new ContentError(409, "This record is not currently published.");
    await tx
      .update(contentRecord)
      .set({
        withdrawnAt: new Date(),
        withdrawalReason: reason,
        version: record.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(contentRecord.id, recordId));
    await audit(tx, actor, "content.withdrawn", recordId, { reason });
    const derived = await tx.execute<{ id: string }>(
      sql`UPDATE content_record SET withdrawn_at=NOW(),withdrawal_reason='A source project was withdrawn',version=version+1,updated_at=NOW() WHERE id IN (SELECT report_record_id FROM report_source WHERE source_record_id=${recordId}) AND published_revision_id IS NOT NULL AND withdrawn_at IS NULL RETURNING id`,
    );
    for (const row of derived.rows)
      await audit(tx, actor, "content.source_withdrawn", row.id, {
        sourceRecordId: recordId,
        reason,
      });
    return { withdrawn: true };
  });
}
export async function getAdminRecord(id: string): Promise<AdminRecord> {
  const db = getDb();
  const record = await db.query.contentRecord.findFirst({
    where: eq(contentRecord.id, id),
  });
  if (!record) throw new ContentError(404, "Record not found.");
  const [revisions, files] = await Promise.all([
    db
      .select()
      .from(contentRevision)
      .where(eq(contentRevision.recordId, id))
      .orderBy(desc(contentRevision.number)),
    db
      .select()
      .from(mediaFile)
      .where(eq(mediaFile.recordId, id))
      .orderBy(desc(mediaFile.createdAt)),
  ]);
  return {
    id,
    code: recordCode(record.kind, record.number),
    kind: record.kind,
    slug: record.slug,
    version: record.version,
    commentsEnabled: record.commentsEnabled,
    reminderDays: record.reminderDays,
    engagementVersion: record.engagementVersion,
    publishedRevisionId: record.publishedRevisionId,
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    withdrawalReason: record.withdrawalReason,
    revisions: revisions.map((r) => ({
      ...r,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      internalOnly: f.internalOnly,
      withdrawn: Boolean(f.withdrawnAt),
    })),
  };
}
export async function listAdminRecords(
  filters: { kind?: ContentKind; pending?: boolean; page?: number } = {},
) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const condition = and(
    filters.kind ? eq(contentRecord.kind, filters.kind) : undefined,
    filters.pending ? eq(contentRevision.state, "pending") : undefined,
    sql`${contentRevision.number} = (select max(r.number) from content_revision r where r.record_id = ${contentRecord.id})`,
  );
  const rows = await db
    .select({ record: contentRecord, revision: contentRevision })
    .from(contentRecord)
    .innerJoin(contentRevision, eq(contentRevision.recordId, contentRecord.id))
    .where(condition)
    .orderBy(
      filters.pending
        ? contentRevision.submittedAt
        : desc(contentRecord.updatedAt),
    )
    .limit(25)
    .offset((page - 1) * 25);
  const items: AdminRecordSummary[] = rows.map(({ record, revision: r }) => ({
    id: record.id,
    code: recordCode(record.kind, record.number),
    kind: record.kind,
    slug: record.slug,
    title: r.payload.title,
    community: r.payload.communityName,
    status: r.payload.status,
    progress: r.payload.progress,
    state: r.state,
    revisionId: r.id,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    published: Boolean(record.publishedRevisionId && !record.withdrawnAt),
    withdrawn: Boolean(record.withdrawnAt),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return { items, page, hasMore: rows.length === 25 };
}
export async function listTaxonomy() {
  return getDb().select().from(taxonomy).orderBy(taxonomy.kind, taxonomy.name);
}
export async function discardDraft(
  actor: Actor,
  recordId: string,
  revisionId: string,
  lockVersion: number,
  reason: string,
) {
  mustSubmit(actor);
  return getDb().transaction(async (tx) => {
    await lockedRecord(tx, recordId);
    const revision = await revisionFor(tx, recordId, revisionId);
    if (revision.state !== "draft" || revision.lockVersion !== lockVersion)
      throw new ContentError(
        409,
        "The draft changed or was submitted. Reload before discarding it.",
      );
    await tx
      .update(contentRevision)
      .set({
        state: "rejected",
        decisionReason: `Draft discarded before submission: ${reason}`,
        updatedAt: new Date(),
        lockVersion: revision.lockVersion + 1,
      })
      .where(eq(contentRevision.id, revisionId));
    await audit(tx, actor, "content.draft_discarded", recordId, {
      revisionId,
      reason,
    });
    return { discarded: true };
  });
}
