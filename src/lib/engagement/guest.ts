import { randomBytes, randomInt, createHmac } from "node:crypto";
import { getPool } from "@/db";
import { hashToken } from "@/lib/security/crypto";
import { appUrl } from "@/lib/env";
import { checkOrigin, privateJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";
import { ContentError } from "@/lib/content/service";
import { ZodError } from "zod";
export type Guest = { id: string; cookie?: string };
export async function getGuest(
  request: Request,
  create = false,
): Promise<Guest | null> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("wassa_device="))
    ?.slice(13);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const result = await getPool().query<{ id: string }>(
      "SELECT id FROM guest_device WHERE token_hash=$1",
      [hashToken(token)],
    );
    if (result.rows[0]) return result.rows[0];
  }
  if (!create) return null;
  if (!(await consumeLimit("guest-session-global", 120, 60)))
    throw new ContentError(429, "Please try again in a minute.");
  const secret = randomBytes(32).toString("base64url"),
    id = crypto.randomUUID();
  await getPool().query(
    "INSERT INTO guest_device (id,token_hash) VALUES ($1,$2)",
    [id, hashToken(secret)],
  );
  return {
    id,
    cookie: `wassa_device=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${appUrl().startsWith("https:") ? "; Secure" : ""}`,
  };
}
export function fingerprint(request: Request) {
  const ip =
    process.env.TRUST_PROXY_HEADERS === "true"
      ? request.headers.get("x-real-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        "unknown"
      : "untrusted-proxy";
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`${new Date().toISOString().slice(0, 10)}:${ip}`)
    .digest("hex");
}
export function answerHash(id: string, answer: string) {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(`guest-challenge:${id}:${answer.trim()}`)
    .digest("hex");
}
export async function challenge(guest: Guest) {
  if (!(await consumeLimit(`guest-challenge:${guest.id}`, 30, 3600)))
    throw new ContentError(429, "Too many forms opened. Try again later.");
  const id = crypto.randomUUID(),
    a = randomInt(1, 10),
    b = randomInt(1, 10);
  await getPool().query(
    "INSERT INTO guest_challenge (id,device_id,answer_hash,expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL '10 minutes')",
    [id, guest.id, answerHash(id, String(a + b))],
  );
  return {
    challengeId: id,
    question: `What is ${a} + ${b}?`,
    minimumWaitSeconds: 2,
  };
}
export async function guestApi(
  request: Request,
  handler: (guest: Guest | null) => Promise<unknown>,
  options: { create?: boolean; required?: boolean } = {},
) {
  try {
    if (request.method !== "GET" && !checkOrigin(request))
      return privateJson({ message: "Invalid request origin." }, 403);
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return privateJson({ message: "Open the form on this website." }, 403);
    const guest = await getGuest(request, options.create);
    if (options.required && !guest)
      throw new ContentError(403, "Open a new form before continuing.");
    const response = privateJson(await handler(guest));
    if (guest?.cookie) response.headers.append("Set-Cookie", guest.cookie);
    return response;
  } catch (error) {
    if (error instanceof ContentError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        { message: error.issues.map((i) => i.message).join(" ") },
        400,
      );
    console.error(
      "Guest operation failed:",
      error instanceof Error ? error.name : "Error",
    );
    return privateJson(
      { message: "The request could not be completed. Please try again." },
      503,
    );
  }
}
