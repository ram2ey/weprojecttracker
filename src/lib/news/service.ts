import "server-only";
import { desc, eq, isNotNull, sql, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLog,
  newsStory,
  contentRecord,
  contentRevision,
} from "@/db/schema";
import { canSubmit } from "@/lib/security/policy";
import { ContentError, type Actor } from "@/lib/content/service";
import { livePublication } from "@/lib/content/public";
import { processEvidence } from "@/lib/content/media";
import { blankStory, type Story } from "./types";

const fields = z
  .object({
    kind: z.enum(["News", "Feature"]),
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().max(500),
    detail: z.string().trim().max(8000),
    project: z.string().max(200),
    caption: z.string().trim().max(180),
  })
  .strict();
const edit = z
  .object({
    action: z.enum(["save", "submit"]),
    id: z.uuid(),
    version: z.int().nonnegative(),
    fields,
    removePhoto: z.boolean(),
  })
  .strict();
const decision = z
  .object({
    action: z.enum(["approve", "return", "withdraw"]),
    id: z.uuid(),
    version: z.int().positive(),
  })
  .strict();

export async function storyProjects() {
  return getDb()
    .select({
      slug: contentRecord.slug,
      title: sql<string>`${contentRevision.payload}->>'title'`,
    })
    .from(contentRecord)
    .innerJoin(
      contentRevision,
      eq(contentRecord.publishedRevisionId, contentRevision.id),
    )
    .where(livePublication)
    .orderBy(sql`${contentRevision.payload}->>'title'`);
}
export async function publishedNews() {
  const rows = await getDb()
    .select({
      id: newsStory.id,
      story: newsStory.published,
      date: newsStory.publishedAt,
      project: contentRecord.slug,
    })
    .from(newsStory)
    .leftJoin(
      contentRecord,
      and(
        eq(contentRecord.slug, sql`${newsStory.published}->>'project'`),
        eq(contentRecord.kind, "project"),
        sql`${contentRecord.withdrawnAt} is null`,
        isNotNull(contentRecord.publishedRevisionId),
      ),
    )
    .where(isNotNull(newsStory.published))
    .orderBy(desc(newsStory.publishedAt), newsStory.id)
    .limit(3);
  return rows.map((r) => ({
    ...r.story!,
    id: r.id,
    date: r.date!.toISOString().slice(0, 10),
    project: r.project ?? "",
  }));
}
export async function newsWorkspace(id?: string) {
  const db = getDb();
  const items = await db
    .select({
      id: newsStory.id,
      state: newsStory.state,
      title: sql<string>`${newsStory.draft}->>'title'`,
    })
    .from(newsStory)
    .orderBy(sql`${newsStory.draft}->>'title'`, newsStory.id);
  const selected = id
    ? (
        await db
          .select({
            id: newsStory.id,
            state: newsStory.state,
            version: newsStory.version,
            draft: newsStory.draft,
            contributors: newsStory.contributors,
            live: isLive,
          })
          .from(newsStory)
          .where(eq(newsStory.id, id))
      )[0]
    : null;
  return { items, selected: selected ?? null };
}
const isLive = sql<boolean>`${newsStory.published} is not null`;
export async function changeNews(actor: Actor, raw: unknown, upload?: File) {
  const input = z.union([edit, decision]).parse(raw);
  const editing = "fields" in input;
  const reviewer = actor.role === "approver" || actor.role === "super_admin";
  if (editing ? !canSubmit(actor.role) : !reviewer)
    throw new ContentError(403, "This action is not available for your role.");
  let photo: string | undefined;
  if (editing && upload) {
    const image = await processEvidence(
      Buffer.from(await upload.arrayBuffer()),
      upload.name,
      upload.type,
    );
    photo = "data:image/webp;base64," + image.thumbnail.toString("base64");
  }
  return getDb().transaction(async (tx) => {
    const [old] = await tx
      .select()
      .from(newsStory)
      .where(eq(newsStory.id, input.id))
      .for("update");
    if ((old?.version ?? 0) !== input.version)
      throw new ContentError(
        409,
        "This story changed. Reload it before continuing.",
      );
    let state: typeof newsStory.$inferSelect.state = "draft";
    let draft: Story = old?.draft ?? blankStory;
    let published = old?.published ?? null,
      publishedAt = old?.publishedAt ?? null;
    let contributors = old?.contributors ?? [];
    if ("fields" in input) {
      if (old?.state === "pending")
        throw new ContentError(409, "Return the submission before editing.");
      draft = {
        ...input.fields,
        photo: photo ?? (input.removePhoto ? "" : draft.photo),
      };
      contributors = [...new Set([...contributors, actor.id])];
      if (input.action === "submit") {
        if (!draft.summary || (draft.photo && !draft.caption))
          throw new ContentError(
            400,
            "Add a summary and a description for any photo.",
          );
        state = "pending";
      }
    } else {
      if (!old) throw new ContentError(404, "Story not found.");
      if (input.action === "withdraw") {
        if (!published)
          throw new ContentError(409, "This story is not published.");
        published = null;
        publishedAt = null;
        state = "withdrawn";
      } else {
        if (old.state !== "pending")
          throw new ContentError(409, "This story is not awaiting approval.");
        if (input.action === "approve") {
          if (contributors.includes(actor.id))
            throw new ContentError(
              403,
              "A different staff member must approve this revision.",
            );
          if (draft.project) {
            const [project] = await tx
              .select({ id: contentRecord.id })
              .from(contentRecord)
              .innerJoin(
                contentRevision,
                eq(contentRecord.publishedRevisionId, contentRevision.id),
              )
              .where(
                and(livePublication, eq(contentRecord.slug, draft.project)),
              );
            if (!project)
              throw new ContentError(
                400,
                "The linked project is unavailable. Return this story for editing.",
              );
          }
          state = "published";
          published = draft;
          publishedAt = new Date();
          contributors = [];
        }
      }
    }
    const values = {
      state,
      draft,
      published,
      publishedAt,
      contributors,
      version: input.version + 1,
    };
    if (old)
      await tx.update(newsStory).set(values).where(eq(newsStory.id, input.id));
    else {
      const inserted = await tx
        .insert(newsStory)
        .values({ ...values, id: input.id })
        .onConflictDoNothing()
        .returning({ id: newsStory.id });
      if (!inserted.length)
        throw new ContentError(409, "Story already saved. Reload it.");
    }
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      action: "news." + input.action,
      subjectId: input.id,
      details: { version: String(values.version) },
    });
    return { id: input.id, version: values.version };
  });
}
