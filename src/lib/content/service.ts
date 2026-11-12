import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { publishEvent, retireEvents } from "@/lib/notifications/events";
import { projectEventKind } from "@/lib/notifications/policy";
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
  type LaunchPayload,
  type AdminRecord,
  type AdminRecordSummary,
} from "./types";
import {
  fixedCategories,
  launchPayload,
  publicationErrors,
} from "./validation";
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
export function recordCode(_kind: ContentKind, number: number) {
  return "WE-P" + String(number).padStart(5, "0");
}
function editor(a: Actor) {
  if (!canSubmit(a.role)) throw new ContentError(403, "Admin access required.");
}
function reviewer(a: Actor) {
  if (!canApprove(a.role))
    throw new ContentError(403, "Admin access required.");
}
async function audit(
  tx: Tx,
  a: Actor,
  action: string,
  id: string,
  details: Record<string, string> = {},
) {
  await tx.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId: a.id,
    action,
    subjectId: id,
    details,
  });
}
async function lockedRecord(tx: Tx, id: string) {
  const [r] = await tx
    .select()
    .from(contentRecord)
    .where(and(eq(contentRecord.id, id), eq(contentRecord.kind, "project")))
    .for("update");
  if (!r) throw new ContentError(404, "Project not found.");
  return r;
}
async function revisionFor(tx: Tx, id: string, rid: string) {
  const [r] = await tx
    .select()
    .from(contentRevision)
    .where(and(eq(contentRevision.id, rid), eq(contentRevision.recordId, id)));
  if (!r) throw new ContentError(404, "Revision not found.");
  return r;
}
async function validate(
  tx: Tx,
  id: string,
  p: ContentPayload,
  required: boolean,
) {
  const category = fixedCategories.find((c) => c.id === p.categoryId);
  const community = p.communityId
    ? await tx.query.taxonomy.findFirst({
        where: and(
          eq(taxonomy.id, p.communityId),
          eq(taxonomy.kind, "community"),
          eq(taxonomy.active, true),
        ),
      })
    : null;
  if (
    (p.categoryId && !category) ||
    (p.communityId && !community) ||
    (required && (!category || !community))
  )
    throw new ContentError(
      400,
      "Choose a fixed category and an active community.",
    );
  if (new Set(p.attachments.map((a) => a.id)).size !== p.attachments.length)
    throw new ContentError(400, "Each photograph may appear only once.");
  const files = p.attachments.length
    ? await tx
        .select()
        .from(mediaFile)
        .where(
          inArray(
            mediaFile.id,
            p.attachments.map((a) => a.id),
          ),
        )
    : [];
  for (const a of p.attachments) {
    const f = files.find((f) => f.id === a.id);
    if (
      !f ||
      f.recordId !== id ||
      f.withdrawnAt ||
      f.internalOnly ||
      !f.mimeType.startsWith("image/")
    )
      throw new ContentError(
        400,
        "A photograph is unavailable or belongs to another project.",
      );
  }
  const next = {
    ...p,
    categoryName: category?.name ?? "",
    communityName: community?.name ?? "",
  };
  if (required) {
    const errors = publicationErrors(launchPayload(next));
    if (errors.length) throw new ContentError(400, errors.join(" "));
  }
  return next;
}
export async function createRecord(
  actor: Actor,
  kind: ContentKind,
  title: string,
) {
  editor(actor);
  if (kind !== "project")
    throw new ContentError(404, "Only projects are available.");
  return getDb().transaction(async (tx) => {
    const id = crypto.randomUUID(),
      revisionId = crypto.randomUUID(),
      stem =
        title
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "project";
    await tx.insert(contentRecord).values({
      id,
      kind: "project",
      slug: stem + "-" + id.slice(0, 8),
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
    await audit(tx, actor, "content.created", id);
    return { recordId: id, revisionId };
  });
}
export async function createRevision(
  actor: Actor,
  id: string,
  sourceId?: string,
) {
  editor(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, id),
      revisions = await tx
        .select()
        .from(contentRevision)
        .where(eq(contentRevision.recordId, id))
        .orderBy(desc(contentRevision.number));
    if (revisions.some((r) => r.state === "draft" || r.state === "pending"))
      throw new ContentError(409, "Open the existing draft or submission.");
    const source = sourceId
      ? revisions.find((r) => r.id === sourceId)
      : revisions[0];
    if (!source) throw new ContentError(404, "Revision not found.");
    const revisionId = crypto.randomUUID();
    const available = await tx
      .select({ id: mediaFile.id })
      .from(mediaFile)
      .where(
        and(
          eq(mediaFile.recordId, id),
          isNull(mediaFile.withdrawnAt),
          eq(mediaFile.internalOnly, false),
          sql`${mediaFile.mimeType} LIKE 'image/%'`,
        ),
      );
    const allowed = new Set(available.map((f) => f.id));
    await tx.insert(contentRevision).values({
      id: revisionId,
      recordId: id,
      number: revisions[0].number + 1,
      baseVersion: record.version,
      authorId: actor.id,
      contributors: [actor.id],
      payload: {
        ...source.payload,
        attachments: source.payload.attachments.filter(
          (a) =>
            allowed.has(a.id) &&
            a.visibility === "public" &&
            a.purpose !== "financial",
        ),
      },
      financials: source.financials,
    });
    await audit(tx, actor, "content.revision_created", id);
    return { recordId: id, revisionId };
  });
}
export async function saveRevision(
  actor: Actor,
  id: string,
  rid: string,
  input: {
    payload: Omit<LaunchPayload, "categoryName" | "communityName">;
    lockVersion: number;
  },
) {
  editor(actor);
  return getDb().transaction(async (tx) => {
    await lockedRecord(tx, id);
    const r = await revisionFor(tx, id, rid);
    if (r.state !== "draft" || r.lockVersion !== input.lockVersion)
      throw new ContentError(
        409,
        "This draft changed. Preserve your changes before reloading.",
      );
    const p = await validate(
      tx,
      id,
      {
        ...r.payload,
        ...input.payload,
        attachments: input.payload.attachments.map((a) => ({
          ...a,
          capturedOn: "",
          purpose: "evidence",
          visibility: "public",
        })),
      },
      false,
    );
    await tx
      .update(contentRevision)
      .set({
        payload: p,
        contributors: [...new Set([...r.contributors, actor.id])],
        lockVersion: r.lockVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(contentRevision.id, rid));
    await tx
      .update(contentRecord)
      .set({ updatedAt: new Date() })
      .where(eq(contentRecord.id, id));
    await audit(tx, actor, "content.draft_saved", id);
    return { lockVersion: r.lockVersion + 1 };
  });
}
export async function submitRevision(
  actor: Actor,
  id: string,
  rid: string,
  lockVersion: number,
) {
  editor(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, id),
      r = await revisionFor(tx, id, rid);
    if (
      r.state !== "draft" ||
      r.lockVersion !== lockVersion ||
      r.baseVersion !== record.version
    )
      throw new ContentError(
        409,
        "The draft or publication changed. Preserve your changes and reload.",
      );
    await validate(tx, id, r.payload, true);
    await tx
      .update(contentRevision)
      .set({
        state: "pending",
        submittedBy: actor.id,
        submittedAt: new Date(),
        lockVersion: r.lockVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(contentRevision.id, rid));
    await audit(tx, actor, "content.submitted", id);
    return { state: "pending" };
  });
}
export async function decideRevision(
  actor: Actor,
  id: string,
  rid: string,
  input: {
    action: "approve" | "return";
    reason: string;
    evidenceReviewed: boolean;
    notifyFollowers?: boolean;
    lockVersion: number;
  },
) {
  reviewer(actor);
  return getDb().transaction(async (tx) => {
    const record = await lockedRecord(tx, id),
      r = await revisionFor(tx, id, rid);
    // Admins may approve their own work (single-role decision, 12 Nov 2026).
    if (r.state !== "pending" || r.lockVersion !== input.lockVersion)
      throw new ContentError(409, "This submission changed. Reload it.");
    if (input.action === "approve") {
      if (!input.evidenceReviewed)
        throw new ContentError(
          400,
          "Confirm that you reviewed the information and photographs.",
        );
      if (record.version !== r.baseVersion)
        throw new ContentError(
          409,
          "Publication changed. Return this submission for a fresh draft.",
        );
      await validate(tx, id, r.payload, true);
      const previous = record.publishedRevisionId
        ? await revisionFor(tx, id, record.publishedRevisionId)
        : undefined;
      const eventKind = projectEventKind(
        previous?.payload.status,
        r.payload.status,
        input.notifyFollowers === true,
      );
      if (eventKind)
        await publishEvent(tx, {
          dedupeKey: "project:" + rid,
          recordId: id,
          kind: eventKind,
          title: r.payload.title,
          categoryId: r.payload.categoryId,
          communityId: r.payload.communityId,
        });
      await tx
        .update(contentRecord)
        .set({
          publishedRevisionId: rid,
          version: record.version + 1,
          withdrawnAt: null,
          withdrawalReason: null,
          updatedAt: new Date(),
        })
        .where(eq(contentRecord.id, id));
    }
    const state = input.action === "approve" ? "approved" : "returned";
    await tx
      .update(contentRevision)
      .set({
        state,
        decidedBy: actor.id,
        decidedAt: new Date(),
        decisionReason: input.reason,
        updatedAt: new Date(),
        lockVersion: r.lockVersion + 1,
      })
      .where(eq(contentRevision.id, rid));
    await audit(tx, actor, "content." + state, id, {
      reason: input.reason,
      notifyFollowers: String(input.notifyFollowers === true),
    });
    return { state };
  });
}
export async function withdrawRecord(actor: Actor, id: string, reason: string) {
  reviewer(actor);
  return getDb().transaction(async (tx) => {
    const r = await lockedRecord(tx, id);
    if (!r.publishedRevisionId || r.withdrawnAt)
      throw new ContentError(409, "This project is not published.");
    await retireEvents(tx, "project", id);
    await tx
      .update(contentRecord)
      .set({
        withdrawnAt: new Date(),
        withdrawalReason: reason,
        version: r.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(contentRecord.id, id));
    await tx
      .update(contentRevision)
      .set({
        state: "returned",
        decisionReason: "Publication withdrawn. Create a fresh draft.",
        lockVersion: sql`${contentRevision.lockVersion}+1`,
      })
      .where(
        and(
          eq(contentRevision.recordId, id),
          inArray(contentRevision.state, ["draft", "pending"]),
        ),
      );
    await audit(tx, actor, "content.withdrawn", id, { reason });
    return { withdrawn: true };
  });
}
export async function getAdminRecord(id: string): Promise<AdminRecord> {
  const db = getDb(),
    record = await db.query.contentRecord.findFirst({
      where: and(eq(contentRecord.id, id), eq(contentRecord.kind, "project")),
    });
  if (!record) throw new ContentError(404, "Project not found.");
  const [revisions, files] = await Promise.all([
    db
      .select()
      .from(contentRevision)
      .where(eq(contentRevision.recordId, id))
      .orderBy(desc(contentRevision.number)),
    db.select().from(mediaFile).where(eq(mediaFile.recordId, id)),
  ]);
  const allowed = new Set(
    files
      .filter((f) => !f.internalOnly && f.mimeType.startsWith("image/"))
      .map((f) => f.id),
  );
  return {
    id,
    code: recordCode("project", record.number),
    kind: "project",
    slug: record.slug,
    version: record.version,
    publishedRevisionId: record.publishedRevisionId,
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
    withdrawalReason: record.withdrawalReason,
    revisions: revisions.map((r) => ({
      id: r.id,
      number: r.number,
      state: r.state,
      lockVersion: r.lockVersion,
      baseVersion: r.baseVersion,
      authorId: r.authorId,
      contributors: r.contributors,
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionReason: r.decisionReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      payload: launchPayload(r.payload, allowed),
    })),
    files: files
      .filter((f) => allowed.has(f.id))
      .map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        internalOnly: f.internalOnly,
        withdrawn: !!f.withdrawnAt,
      })),
  };
}
export async function listAdminRecords(
  filters: { pending?: boolean; page?: number; q?: string } = {},
) {
  const page = filters.page ?? 1,
    q = filters.q?.trim().toLowerCase();
  const rows = await getDb()
    .select({ record: contentRecord, revision: contentRevision })
    .from(contentRecord)
    .innerJoin(contentRevision, eq(contentRevision.recordId, contentRecord.id))
    .where(
      and(
        eq(contentRecord.kind, "project"),
        sql`${contentRevision.number}=(SELECT max(c.number) FROM content_revision c WHERE c.record_id=${contentRecord.id})`,
        filters.pending ? eq(contentRevision.state, "pending") : undefined,
        q
          ? sql`position(${q} in lower(concat_ws(' ', 'WE-P'||lpad(${contentRecord.number}::text,5,'0'), ${contentRevision.payload}->>'title',${contentRevision.payload}->>'communityName')))>0`
          : undefined,
      ),
    )
    .orderBy(
      filters.pending
        ? contentRevision.submittedAt
        : desc(contentRecord.updatedAt),
      contentRecord.id,
    )
    .limit(25)
    .offset((page - 1) * 24);
  const items: AdminRecordSummary[] = rows
    .slice(0, 24)
    .map(({ record: r, revision: v }) => ({
      id: r.id,
      code: recordCode("project", r.number),
      kind: "project",
      slug: r.slug,
      title: v.payload.title,
      community: v.payload.communityName,
      status: v.payload.status,
      state: v.state,
      revisionId: v.id,
      submittedAt: v.submittedAt?.toISOString() ?? null,
      published: !!r.publishedRevisionId && !r.withdrawnAt,
      withdrawn: !!r.withdrawnAt,
      updatedAt: v.updatedAt.toISOString(),
    }));
  return { items, page, hasMore: rows.length > 24 };
}
export async function listTaxonomy() {
  const communities = await getDb()
    .select()
    .from(taxonomy)
    .where(eq(taxonomy.kind, "community"))
    .orderBy(taxonomy.name);
  return [
    ...fixedCategories.map((c) => ({
      ...c,
      kind: "category" as const,
      parentId: null,
      active: true,
    })),
    ...communities,
  ];
}
