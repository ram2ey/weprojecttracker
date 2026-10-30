import { createHmac } from "node:crypto";
import { getPool } from "@/db";
export async function consumeLimit(
  subject: string,
  maximum = 8,
  windowSeconds = 900,
) {
  const key = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(subject)
    .digest("hex");
  const result = await getPool().query<{ count: number }>(
    `INSERT INTO app_rate_limit (key, count, resets_at) VALUES ($1, 1, NOW() + $2 * INTERVAL '1 second')
     ON CONFLICT (key) DO UPDATE SET count = CASE WHEN app_rate_limit.resets_at < NOW() THEN 1 ELSE app_rate_limit.count + 1 END,
     resets_at = CASE WHEN app_rate_limit.resets_at < NOW() THEN NOW() + $2 * INTERVAL '1 second' ELSE app_rate_limit.resets_at END RETURNING count`,
    [key, windowSeconds],
  );
  return result.rows[0].count <= maximum;
}
