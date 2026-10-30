import { z } from "zod";
import { getPool } from "@/db";
import { staffApi, jsonBody } from "@/lib/content/api";
export function GET(request: Request) {
  return staffApi(request, async (actor) => {
    const result = await getPool().query(
      "SELECT n.id,n.kind,n.record_id,n.subject_id,n.created_at,n.read_at,coalesce(a.submission_id,n.subject_id) AS submission_id FROM staff_notice n LEFT JOIN official_reply a ON n.kind='official_reply' AND a.id=n.subject_id WHERE n.recipient_id=$1 ORDER BY n.created_at DESC LIMIT 100",
      [actor.id],
    );
    const unread = await getPool().query(
      "SELECT count(*)::int AS total FROM staff_notice WHERE recipient_id=$1 AND read_at IS NULL",
      [actor.id],
    );
    return { items: result.rows, unread: unread.rows[0].total };
  });
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    const input = z
      .object({ ids: z.array(z.uuid()).min(1).max(100) })
      .strict()
      .parse(await jsonBody(request));
    await getPool().query(
      "UPDATE staff_notice SET read_at=coalesce(read_at,NOW()) WHERE recipient_id=$1 AND id=ANY($2::text[])",
      [actor.id, input.ids],
    );
    return { read: true };
  });
}
