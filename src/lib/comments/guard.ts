import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const commentCookie = "wassa_comment_guard";
export function commentHash(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Comment guard is not configured.");
  return createHmac("sha256", secret)
    .update("comments:v1:" + value)
    .digest("hex");
}
export function createCommentGuard(now = Date.now()) {
  const payload = `${randomUUID()}.${Math.floor(now / 1000) + 86400}`;
  return `${payload}.${commentHash(payload)}`;
}
export function readCommentGuard(cookie: string, now = Date.now()) {
  const values = cookie
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(commentCookie + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(commentCookie.length + 1);
  if (!/^[a-f0-9-]{36}\.\d{10}\.[a-f0-9]{64}$/.test(value)) return null;
  const [id, expiry, signature] = value.split(".");
  const seconds = Math.floor(now / 1000);
  if (Number(expiry) <= seconds || Number(expiry) > seconds + 86400)
    return null;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(commentHash(`${id}.${expiry}`), "hex"),
  )
    ? id
    : null;
}
