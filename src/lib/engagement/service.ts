import { getPool } from "@/db";
import { ContentError, type Actor } from "@/lib/content/service";
import { canSubmit } from "@/lib/security/policy";
import { consumeLimit } from "@/lib/security/rate-limit";
import { transaction, audit, notify, type Tx } from "./db";
import { answerHash, fingerprint, type Guest } from "./guest";
import {
  spamReason,
  submissionSchema,
  moderationSchema,
  settingsSchema,
} from "./validation";
import type { z } from "zod";
import type {
  ModerationRow,
  ReplyRow,
  PublicComment,
  OwnSubmission,
} from "./types";
export async function liveProject(
  tx: Pick<Tx, "query">,
  id: string,
  lock = false,
) {
  const result = await tx.query<{
    id: string;
    comments_enabled: boolean;
    reminder_days: number;
    engagement_version: number;
  }>(
    `SELECT r.id,r.comments_enabled,r.reminder_days,r.engagement_version FROM content_record r JOIN content_revision v ON r.published_revision_id=v.id AND v.record_id=r.id WHERE r.id=$1 AND r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' ${lock ? "FOR UPDATE OF r" : ""}`,
    [id],
  );
  if (!result.rows[0])
    throw new ContentError(404, "This published project is unavailable.");
  return result.rows[0];
}
function mustReview(actor: Actor) {
  if (!["approver", "super_admin"].includes(actor.role))
    throw new ContentError(403, "Approver access is required.");
}
export async function submitGuest(
  request: Request,
  guest: Guest,
  input: z.infer<typeof submissionSchema>,
  staffAuthorId: string | null,
) {
  const fp = fingerprint(request);
  const blocked = input.website ? "honeypot" : spamReason(input.body);
  if (blocked) {
    await getPool().query(
      "INSERT INTO abuse_log (id,fingerprint,reason) VALUES ($1,$2,$3)",
      [crypto.randomUUID(), fp, blocked],
    );
    throw new ContentError(
      400,
      "Please submit a concise, relevant message without repeated text or multiple links.",
    );
  }
  if (
    !(await consumeLimit(`guest-submit:${guest.id}`, 6, 3600)) ||
    !(await consumeLimit(
      `guest-submit-ip:${fp}`,
      process.env.TRUST_PROXY_HEADERS === "true" ? 30 : 120,
      3600,
    ))
  )
    throw new ContentError(
      429,
      "Too many submissions. Please try again later.",
    );
  return transaction(async (tx) => {
    const project = await liveProject(tx, input.recordId, true);
    if (input.kind === "comment" && !project.comments_enabled)
      throw new ContentError(
        409,
        "New comments are currently closed for this project.",
      );
    const check = await tx.query<{
      answer_hash: string;
      created_at: Date;
      expires_at: Date;
      used_at: Date | null;
    }>(
      "SELECT answer_hash,created_at,expires_at,used_at FROM guest_challenge WHERE id=$1 AND device_id=$2 FOR UPDATE",
      [input.challengeId, guest.id],
    );
    const c = check.rows[0];
    if (
      !c ||
      c.used_at ||
      c.expires_at < new Date() ||
      c.answer_hash !== answerHash(input.challengeId, input.answer)
    )
      throw new ContentError(
        400,
        "The check is invalid or expired. Open a new form and try again.",
      );
    if (Date.now() - c.created_at.getTime() < 2000)
      throw new ContentError(
        400,
        "Please take a moment to review your message before submitting.",
      );
    if (input.kind === "report") {
      const parent = await tx.query(
        "SELECT id FROM guest_submission WHERE id=$1 AND record_id=$2 AND kind='comment' AND state='approved'",
        [input.parentId ?? "", input.recordId],
      );
      if (!parent.rowCount)
        throw new ContentError(404, "That public comment is unavailable.");
      const duplicate = await tx.query(
        "SELECT 1 FROM guest_submission WHERE parent_id=$1 AND device_id=$2 AND created_at>NOW()-INTERVAL '30 days'",
        [input.parentId, guest.id],
      );
      if (duplicate.rowCount)
        throw new ContentError(409, "You already reported this comment.");
    } else if (input.parentId)
      throw new ContentError(
        400,
        "Only a comment report may identify a parent comment.",
      );
    const duplicate = await tx.query(
      "SELECT 1 FROM guest_submission WHERE record_id=$1 AND device_id=$2 AND lower(body)=lower($3) AND created_at>NOW()-INTERVAL '1 day'",
      [input.recordId, guest.id, input.body],
    );
    if (duplicate.rowCount)
      throw new ContentError(409, "This message has already been submitted.");
    const id = crypto.randomUUID();
    await tx.query("UPDATE guest_challenge SET used_at=NOW() WHERE id=$1", [
      input.challengeId,
    ]);
    await tx.query("UPDATE guest_device SET last_seen_at=NOW() WHERE id=$1", [
      guest.id,
    ]);
    await tx.query(
      "INSERT INTO guest_submission (id,record_id,device_id,staff_author_id,kind,parent_id,display_name,body) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        input.recordId,
        guest.id,
        staffAuthorId,
        input.kind,
        input.parentId ?? null,
        input.displayName || null,
        input.body,
      ],
    );
    await audit(tx, staffAuthorId, "engagement.submitted", id, {
      kind: input.kind,
      recordId: input.recordId,
    });
    await notify(tx, "guest_submission", id, input.recordId, staffAuthorId);
    return {
      id,
      state: "pending",
      message:
        input.kind === "comment"
          ? "Your comment is awaiting review. It is not public yet."
          : "Your message was received privately. You can check for an approved response on this device.",
    };
  });
}
export async function discussion(
  recordId: string,
  guest: Guest | null,
  page = 1,
) {
  const project = await liveProject(getPool(), recordId);
  const [comments, own] = await Promise.all([
    getPool().query<{
      id: string;
      display_name: string | null;
      body: string;
      created_at: Date;
    }>(
      "SELECT id,display_name,body,created_at FROM guest_submission WHERE record_id=$1 AND kind='comment' AND state='approved' ORDER BY created_at DESC,id LIMIT 20 OFFSET $2",
      [recordId, (page - 1) * 20],
    ),
    guest
      ? getPool().query<{
          id: string;
          kind: OwnSubmission["kind"];
          body: string;
          state: OwnSubmission["state"];
          created_at: Date;
        }>(
          "SELECT id,kind,body,state,created_at FROM guest_submission WHERE record_id=$1 AND device_id=$2 ORDER BY created_at DESC LIMIT 30",
          [recordId, guest.id],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  const ids = [...comments.rows, ...own.rows].map((r) => r.id);
  const replies = ids.length
    ? await getPool().query<{
        id: string;
        submission_id: string;
        body: string;
        decided_at: Date;
      }>(
        "SELECT id,submission_id,body,decided_at FROM official_reply WHERE submission_id=ANY($1::text[]) AND state='approved' ORDER BY decided_at",
        [ids],
      )
    : { rows: [] };
  const forId = (id: string) =>
    replies.rows
      .filter((r) => r.submission_id === id)
      .map((r) => ({
        id: r.id,
        body: r.body,
        publishedAt: r.decided_at.toISOString(),
      }));
  return {
    commentsEnabled: project.comments_enabled,
    comments: comments.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name || "Guest",
      body: r.body,
      createdAt: r.created_at.toISOString(),
      replies: forId(r.id),
    })) as PublicComment[],
    own: own.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      state: r.state,
      createdAt: r.created_at.toISOString(),
      replies: ["withdrawn", "rejected"].includes(r.state) ? [] : forId(r.id),
    })) as OwnSubmission[],
    page,
    hasMore: comments.rows.length === 20,
  };
}
export async function withdrawOwn(guest: Guest, id: string) {
  return transaction(async (tx) => {
    const result = await tx.query<{
      record_id: string;
      kind: string;
      state: string;
    }>(
      "SELECT record_id,kind,state FROM guest_submission WHERE id=$1 AND device_id=$2 FOR UPDATE",
      [id, guest.id],
    );
    const row = result.rows[0];
    if (!row)
      throw new ContentError(404, "Submission not found on this device.");
    if (row.state === "withdrawn")
      throw new ContentError(409, "This submission was already withdrawn.");
    await tx.query(
      "UPDATE guest_submission SET state='withdrawn',body='',display_name=NULL,version=version+1,decided_at=NOW(),decision_reason='Withdrawn by its visitor' WHERE id=$1",
      [id],
    );
    await audit(tx, null, "engagement.visitor_withdrawn", id, {
      kind: row.kind,
      recordId: row.record_id,
    });
    return { withdrawn: true };
  });
}
export async function listModeration(
  page = 1,
  state = "pending",
  kind = "all",
  submissionId?: string,
) {
  const rows = await getPool().query<ModerationRow>(
    `SELECT s.*,v.payload->>'title' AS title,r.slug FROM guest_submission s JOIN content_record r ON r.id=s.record_id JOIN content_revision v ON v.id=r.published_revision_id WHERE ($1='all' OR s.state=$1 OR ($1='pending' AND EXISTS (SELECT 1 FROM official_reply a WHERE a.submission_id=s.id AND a.state='pending'))) AND ($2='all' OR s.kind=$2) AND ($4::text IS NULL OR s.id=$4) ORDER BY s.created_at DESC,s.id LIMIT 25 OFFSET $3`,
    [state, kind, (page - 1) * 25, submissionId ?? null],
  );
  const replyRows = await getPool().query<ReplyRow>(
    "SELECT * FROM official_reply WHERE submission_id=ANY($1::text[]) ORDER BY created_at DESC",
    [rows.rows.map((r) => r.id)],
  );
  return {
    items: rows.rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
      replies: replyRows.rows
        .filter((a) => a.submission_id === r.id)
        .map((a) => ({
          ...a,
          created_at: new Date(a.created_at).toISOString(),
        })),
    })),
    page,
    hasMore: rows.rows.length === 25,
  };
}
export async function moderate(
  actor: Actor,
  id: string,
  input: z.infer<typeof moderationSchema>,
) {
  mustReview(actor);
  return transaction(async (tx) => {
    const result = await tx.query<ModerationRow>(
      "SELECT * FROM guest_submission WHERE id=$1 FOR UPDATE",
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new ContentError(404, "Submission not found.");
    if (row.version !== input.version)
      throw new ContentError(
        409,
        "This submission changed. Reload before deciding.",
      );
    if (input.action !== "withdraw" && row.staff_author_id === actor.id)
      throw new ContentError(
        403,
        "Another approver must review your submission.",
      );
    if (
      input.action === "approve" &&
      (row.kind !== "comment" || row.state !== "pending")
    )
      throw new ContentError(409, "Only pending comments can be published.");
    if (input.action === "approve") {
      await liveProject(tx, row.record_id);
      if (!input.reviewed)
        throw new ContentError(
          400,
          "Confirm that the comment is suitable for public display and contains no internal information.",
        );
    }
    if (input.action === "withdraw" && row.state !== "approved")
      throw new ContentError(409, "This comment is not public.");
    if (["reject", "resolve"].includes(input.action) && row.state !== "pending")
      throw new ContentError(409, "This submission has already been decided.");
    if (input.action === "resolve" && row.kind === "comment")
      throw new ContentError(400, "Approve or reject a comment instead.");
    const state = {
      approve: "approved",
      reject: "rejected",
      withdraw: "withdrawn",
      resolve: "resolved",
    }[input.action];
    await tx.query(
      "UPDATE guest_submission SET state=$2,version=version+1,decided_at=NOW(),decided_by=$3,decision_reason=$4,body=CASE WHEN $2='withdrawn' THEN '' ELSE body END,display_name=CASE WHEN $2='withdrawn' THEN NULL ELSE display_name END WHERE id=$1",
      [id, state, actor.id, input.reason],
    );
    await audit(tx, actor.id, `engagement.${state}`, id, {
      kind: row.kind,
      reason: input.reason,
    });
    return { state };
  });
}
export async function prepareReply(
  actor: Actor,
  submissionId: string,
  body: string,
) {
  if (!canSubmit(actor.role))
    throw new ContentError(
      403,
      "An officer or operator must prepare official replies.",
    );
  return transaction(async (tx) => {
    const result = await tx.query<{
      record_id: string;
      kind: string;
      state: string;
    }>(
      "SELECT record_id,kind,state FROM guest_submission WHERE id=$1 FOR UPDATE",
      [submissionId],
    );
    const row = result.rows[0];
    if (
      !row ||
      ["withdrawn", "rejected"].includes(row.state) ||
      row.kind === "report"
    )
      throw new ContentError(
        409,
        "This submission cannot receive an official response.",
      );
    await liveProject(tx, row.record_id);
    if (row.kind === "comment" && row.state !== "approved")
      throw new ContentError(
        409,
        "Approve the visitor comment before replying publicly.",
      );
    const existing = await tx.query(
      "SELECT 1 FROM official_reply WHERE submission_id=$1 AND state='pending'",
      [submissionId],
    );
    if (existing.rowCount)
      throw new ContentError(409, "A response already awaits review.");
    const id = crypto.randomUUID();
    await tx.query(
      "INSERT INTO official_reply (id,submission_id,author_id,body) VALUES ($1,$2,$3,$4)",
      [id, submissionId, actor.id, body],
    );
    await audit(tx, actor.id, "reply.submitted", id, { submissionId });
    await notify(tx, "official_reply", id, row.record_id, actor.id);
    return { id, state: "pending" };
  });
}
export async function reviewReply(
  actor: Actor,
  id: string,
  input: z.infer<typeof moderationSchema>,
) {
  mustReview(actor);
  return transaction(async (tx) => {
    const result = await tx.query<
      ReplyRow & { record_id: string; kind: string; submission_state: string }
    >(
      "SELECT a.*,s.record_id,s.kind,s.state AS submission_state FROM official_reply a JOIN guest_submission s ON s.id=a.submission_id WHERE a.id=$1 FOR UPDATE OF a,s",
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new ContentError(404, "Response not found.");
    if (row.version !== input.version)
      throw new ContentError(409, "The response was already changed.");
    if (input.action !== "withdraw" && row.author_id === actor.id)
      throw new ContentError(
        403,
        "You cannot approve or reject your own response.",
      );
    if (input.action === "resolve")
      throw new ContentError(400, "Approve, reject, or withdraw the response.");
    if (
      input.action === "withdraw"
        ? row.state !== "approved"
        : row.state !== "pending"
    )
      throw new ContentError(409, "This response has already been decided.");
    if (input.action === "approve") {
      await liveProject(tx, row.record_id);
      if (
        row.submission_state === "withdrawn" ||
        (row.kind === "comment" && row.submission_state !== "approved")
      )
        throw new ContentError(
          409,
          "The original submission is no longer available.",
        );
      if (!input.reviewed)
        throw new ContentError(
          400,
          "Confirm the response is suitable for its public or private audience.",
        );
    }
    const state =
      input.action === "approve"
        ? "approved"
        : input.action === "reject"
          ? "rejected"
          : "withdrawn";
    await tx.query(
      "UPDATE official_reply SET state=$2,version=version+1,decided_at=NOW(),decided_by=$3,decision_reason=$4 WHERE id=$1",
      [id, state, actor.id, input.reason],
    );
    await audit(tx, actor.id, `reply.${state}`, id, { reason: input.reason });
    return { state };
  });
}
export async function updateEngagementSettings(
  actor: Actor,
  recordId: string,
  input: z.infer<typeof settingsSchema>,
) {
  mustReview(actor);
  return transaction(async (tx) => {
    const row = await tx.query<{ engagement_version: number }>(
      "SELECT engagement_version FROM content_record WHERE id=$1 AND kind='project' FOR UPDATE",
      [recordId],
    );
    if (!row.rows[0]) throw new ContentError(404, "Project not found.");
    if (row.rows[0].engagement_version !== input.version)
      throw new ContentError(
        409,
        "These settings changed. Reload before saving.",
      );
    await tx.query(
      "UPDATE content_record SET comments_enabled=$2,reminder_days=$3,engagement_version=engagement_version+1 WHERE id=$1",
      [recordId, input.commentsEnabled, input.reminderDays],
    );
    await audit(tx, actor.id, "engagement.settings_changed", recordId, {
      reason: input.reason,
      commentsEnabled: String(input.commentsEnabled),
      reminderDays: String(input.reminderDays),
    });
    return { version: input.version + 1 };
  });
}
