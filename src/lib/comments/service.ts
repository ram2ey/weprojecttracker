import "server-only";
import { z } from "zod";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { ContentError, type Actor } from "@/lib/content/service";
import { commentHash } from "./guard";
import { commentInput, type CommentPage, type ManagedPage } from "./policy";

const live = `r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' AND v.record_id=r.id`;
const joined = `content_record r JOIN content_revision v ON v.id=r.published_revision_id`;
export function commentPageNumber(value: string | null) {
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(value ?? 1);
}
function operator(actor: Actor) {
  if (actor.role !== "super_admin")
    throw new ContentError(403, "Operator access required.");
}
export async function listComments(
  slug: string,
  page = 1,
): Promise<CommentPage> {
  // One statement gives publication, visibility and the list a common snapshot.
  const result = await getPool().query(
    `SELECT r.comments_enabled, COALESCE((SELECT jsonb_agg(c ORDER BY c."createdAt" DESC,c.id DESC) FROM (
      SELECT id,display_name AS "displayName",body,created_at AT TIME ZONE 'UTC' AS "createdAt" FROM project_comment
      WHERE record_id=r.id AND hidden_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET $2
    ) c),'[]'::jsonb) AS items FROM ${joined} WHERE r.slug=$1 AND ${live}`,
    [slug, (page - 1) * 20],
  );
  if (!result.rowCount)
    throw new ContentError(404, "This project is no longer available.");
  const row = result.rows[0];
  return {
    enabled: row.comments_enabled,
    items: row.items.slice(0, 20),
    page,
    hasMore: row.items.length > 20,
  };
}
async function limit(
  tx: PoolClient,
  subject: string,
  maximum: number,
  seconds: number,
) {
  const result = await tx.query(
    `INSERT INTO app_rate_limit (key,count,resets_at) VALUES ($1,1,NOW()+$2*INTERVAL '1 second')
     ON CONFLICT (key) DO UPDATE SET count=CASE WHEN app_rate_limit.resets_at<NOW() THEN 1 ELSE app_rate_limit.count+1 END,
     resets_at=CASE WHEN app_rate_limit.resets_at<NOW() THEN NOW()+$2*INTERVAL '1 second' ELSE app_rate_limit.resets_at END RETURNING count`,
    [commentHash(subject), seconds],
  );
  return result.rows[0].count <= maximum;
}
export async function submitComment(
  slug: string,
  browser: string,
  raw: unknown,
) {
  const tx = await getPool().connect();
  try {
    await tx.query("BEGIN");
    // Serialize retries from one browser and writes against closing/withdrawal.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      commentHash(browser),
    ]);
    const record = await tx.query(
      `SELECT r.id,r.comments_enabled FROM ${joined} WHERE r.slug=$1 AND ${live} FOR UPDATE OF r`,
      [slug],
    );
    if (!record.rowCount)
      throw new ContentError(404, "This project is no longer available.");
    const input = commentInput.safeParse(raw);
    const key = input.success
      ? commentHash(`${browser}:${input.data.submissionId}`)
      : null;
    if (key) {
      const previous = await tx.query(
        "SELECT id,record_id,display_name,body,hidden_at FROM project_comment WHERE submission_key=$1",
        [key],
      );
      if (previous.rowCount) {
        const old = previous.rows[0];
        if (
          old.record_id !== record.rows[0].id ||
          old.display_name !== input.data!.displayName ||
          old.body !== input.data!.body ||
          input.data!.website
        )
          throw new ContentError(
            409,
            "This submission was already used. Refresh before posting a different comment.",
          );
        await tx.query("COMMIT");
        return { id: old.id as string, visible: !old.hidden_at };
      }
    }
    if (!record.rows[0].comments_enabled)
      throw new ContentError(409, "New comments are closed for this project.");
    const globalAllowed = await limit(tx, "global", 60, 60);
    const browserAllowed = await limit(tx, "browser:" + browser, 3, 600);
    // Expired counters contain no raw browser tokens or IP addresses.
    await tx.query(
      "DELETE FROM app_rate_limit WHERE resets_at < NOW() - INTERVAL '1 day'",
    );
    if (
      !globalAllowed ||
      !browserAllowed ||
      !input.success ||
      input.data.website
    ) {
      // Keep attempt counters even for invalid submissions.
      await tx.query("COMMIT");
      if (!globalAllowed || !browserAllowed)
        throw new ContentError(
          429,
          "Posting limit reached. Please wait before trying again.",
        );
      throw new ContentError(
        400,
        "Enter a name (1–80 characters) and comment (1–2,000 characters). Leave the website field empty.",
      );
    }
    const id = crypto.randomUUID();
    await tx.query(
      "INSERT INTO project_comment (id,record_id,submission_key,display_name,body) VALUES ($1,$2,$3,$4,$5)",
      [id, record.rows[0].id, key, input.data.displayName, input.data.body],
    );
    await tx.query("COMMIT");
    return { id, visible: true };
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
export async function managedComments(
  actor: Actor,
  project: string | null,
  hidden: boolean,
  page: number,
): Promise<ManagedPage> {
  operator(actor);
  const [comments, projects] = await Promise.all([
    getPool().query(
      `SELECT c.id,c.record_id AS "recordId",c.display_name AS "displayName",c.body,c.created_at AS "createdAt",c.hidden_at AS "hiddenAt",c.version,
      COALESCE(v.payload->>'title',r.slug) AS "projectTitle" FROM project_comment c JOIN content_record r ON r.id=c.record_id
      LEFT JOIN content_revision v ON v.id=r.published_revision_id
      WHERE ($1::text IS NULL OR c.record_id=$1) AND (c.hidden_at IS NOT NULL)=$2
      ORDER BY c.created_at DESC,c.id DESC LIMIT 21 OFFSET $3`,
      [project, hidden, (page - 1) * 20],
    ),
    getPool()
      .query(`SELECT r.id,COALESCE(v.payload->>'title',r.slug) AS title,r.comments_enabled AS enabled,r.engagement_version AS version
      FROM content_record r LEFT JOIN content_revision v ON v.id=r.published_revision_id WHERE r.kind='project' ORDER BY title,r.id`),
  ]);
  return {
    items: comments.rows.slice(0, 20),
    projects: projects.rows,
    page,
    hasMore: comments.rows.length > 20,
  };
}
export async function moderateComment(
  actor: Actor,
  id: string,
  hidden: boolean,
  version: number,
) {
  operator(actor);
  const tx = await getPool().connect();
  try {
    await tx.query("BEGIN");
    const changed = await tx.query(
      `UPDATE project_comment SET hidden_at=CASE WHEN $2 THEN NOW() ELSE NULL END,moderated_at=NOW(),moderated_by=$3,version=version+1 WHERE id=$1 AND version=$4 RETURNING id`,
      [id, hidden, actor.id, version],
    );
    if (!changed.rowCount)
      throw new ContentError(
        409,
        "This comment changed. Reload the list before trying again.",
      );
    await tx.query(
      "INSERT INTO audit_log (id,actor_id,action,subject_id) VALUES ($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        actor.id,
        hidden ? "comment.hidden" : "comment.restored",
        id,
      ],
    );
    await tx.query("COMMIT");
    return { id };
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
export async function changeCommenting(
  actor: Actor,
  id: string,
  enabled: boolean,
  version: number,
) {
  operator(actor);
  const tx = await getPool().connect();
  try {
    await tx.query("BEGIN");
    const changed = await tx.query(
      "UPDATE content_record SET comments_enabled=$2,engagement_version=engagement_version+1 WHERE id=$1 AND kind='project' AND engagement_version=$3 RETURNING id",
      [id, enabled, version],
    );
    if (!changed.rowCount)
      throw new ContentError(
        409,
        "This project setting changed. Reload before trying again.",
      );
    await tx.query(
      "INSERT INTO audit_log (id,actor_id,action,subject_id) VALUES ($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        actor.id,
        enabled ? "comments.opened" : "comments.closed",
        id,
      ],
    );
    await tx.query("COMMIT");
    return { id };
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
