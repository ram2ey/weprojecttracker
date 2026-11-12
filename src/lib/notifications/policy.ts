import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createECDH,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

export const deviceCookie = "wassa_notifications";
export const deviceDays = 180;
export const eventDays = 90;
export const deliveryHours = 24;
export const maxAttempts = 6;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function cookieToken(cookie: string) {
  const values = cookie
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(deviceCookie + "="));
  const value = values[0]?.slice(deviceCookie.length + 1);
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(value)
    ? value
    : null;
}
export const followSchema = z
  .object({
    kind: z.enum(["project", "category", "community", "news"]),
    target: z.string().min(1).max(100),
  })
  .strict()
  .refine((v) => v.kind !== "news" || v.target === "all");
export type Follow = z.infer<typeof followSchema>;
export function allowedEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      ((u.hostname === "fcm.googleapis.com" && u.pathname.startsWith("/")) ||
        (u.hostname === "updates.push.services.mozilla.com" &&
          u.pathname.startsWith("/wpush/")) ||
        (/^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname) &&
          u.pathname !== "/") ||
        (/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname) &&
          u.pathname !== "/"))
    );
  } catch {
    return false;
  }
}
function keyBytes(bytes: number) {
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine(
      (v) =>
        Buffer.from(v, "base64url").length === bytes &&
        Buffer.from(v, "base64url").toString("base64url") === v,
    );
}
export const subscriptionSchema = z
  .object({
    endpoint: z.string().max(2048).refine(allowedEndpoint),
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: keyBytes(65).refine(
          (v) => Buffer.from(v, "base64url")[0] === 4,
        ),
        auth: keyBytes(16),
      })
      .strict(),
  })
  .strict();
export type Subscription = z.infer<typeof subscriptionSchema>;
export function pushConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  const enabled = env.ENABLE_BROWSER_PUSH === "true";
  if (!enabled) return { enabled: false as const };
  const publicKey = keyBytes(65).parse(env.VAPID_PUBLIC_KEY);
  keyBytes(32).parse(env.VAPID_PRIVATE_KEY);
  const vapid = createECDH("prime256v1");
  vapid.setPrivateKey(Buffer.from(env.VAPID_PRIVATE_KEY!, "base64url"));
  if (vapid.getPublicKey().toString("base64url") !== publicKey)
    throw new Error("VAPID keys do not match");
  keyBytes(32).parse(env.NOTIFICATION_ENCRYPTION_KEY);
  const subject = new URL(env.VAPID_SUBJECT || "");
  if (
    !["https:", "mailto:"].includes(subject.protocol) ||
    subject.username ||
    subject.password
  )
    throw new Error("Invalid VAPID subject");
  return {
    enabled: true as const,
    publicKey,
    privateKey: env.VAPID_PRIVATE_KEY!,
    subject: subject.href,
  };
}
function encryptionKey() {
  return Buffer.from(
    keyBytes(32).parse(process.env.NOTIFICATION_ENCRYPTION_KEY),
    "base64url",
  );
}
export function encryptSubscription(value: Subscription, deviceId: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(deviceId));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((v) => v.toString("base64url"))
    .join(".");
}
export function decryptSubscription(value: string, deviceId: string) {
  const [iv, tag, data] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(deviceId));
  cipher.setAuthTag(tag);
  return subscriptionSchema.parse(
    JSON.parse(
      Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8"),
    ),
  );
}
export function projectEventKind(
  previousStatus: string | undefined,
  status: string,
  major: boolean,
) {
  return previousStatus === undefined
    ? "project-published"
    : previousStatus !== status
      ? "status-changed"
      : major
        ? "project-updated"
        : null;
}
export function deliveryOutcome(status: number | undefined, attempts: number) {
  if (status && status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "expired";
  if (attempts >= maxAttempts) return "failed";
  return !status || status === 408 || status === 429 || status >= 500
    ? "retry"
    : "failed";
}
export function retrySeconds(attempt: number, retryAfter?: string) {
  const server = retryAfter
    ? /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : (Date.parse(retryAfter) - Date.now()) / 1000
    : 0;
  return Math.min(
    86400,
    Math.max(
      30 * 2 ** Math.min(attempt, 10),
      Number.isFinite(server) ? server : 0,
    ),
  );
}
