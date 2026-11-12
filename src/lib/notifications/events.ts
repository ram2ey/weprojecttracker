import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { notificationEvent } from "@/db/schema";
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
export async function publishEvent(
  tx: Tx,
  input: Omit<typeof notificationEvent.$inferInsert, "id">,
) {
  await tx
    .insert(notificationEvent)
    .values({ ...input, id: randomUUID() })
    .onConflictDoNothing();
}
export async function retireEvents(
  tx: Tx,
  kind: "project" | "news",
  id: string,
) {
  await tx
    .update(notificationEvent)
    .set({ retiredAt: new Date() })
    .where(
      eq(
        kind === "project"
          ? notificationEvent.recordId
          : notificationEvent.storyId,
        id,
      ),
    );
  await tx.execute(sql`UPDATE notification_receipt SET state='cancelled', claim_token=NULL, lease_until=NULL
    WHERE state IN ('pending','retry','sending') AND event_id IN
    (SELECT id FROM notification_event WHERE retired_at IS NOT NULL)`);
}

// Fixed SQL fragments, never interpolated from requests. Aliases used throughout
// inbox and dispatch queries: e=event, c=project, cr=public revision, n=news.
export const eventJoins = `LEFT JOIN content_record c ON c.id=e.record_id
  LEFT JOIN content_revision cr ON cr.id=c.published_revision_id AND cr.record_id=c.id
  LEFT JOIN news_story n ON n.id=e.story_id`;
export const visibleEvent = `e.retired_at IS NULL AND e.created_at > NOW()-INTERVAL '90 days' AND
  ((e.record_id IS NOT NULL AND c.kind='project' AND c.withdrawn_at IS NULL AND cr.state='approved')
    OR (e.story_id IS NOT NULL AND n.published IS NOT NULL))`;
export const matchingFollow = `((f.kind='project' AND f.target=e.record_id)
  OR (f.kind='category' AND f.target=e.category_id)
  OR (f.kind='community' AND f.target=e.community_id)
  OR (f.kind='news' AND f.target='all' AND e.story_id IS NOT NULL))`;
