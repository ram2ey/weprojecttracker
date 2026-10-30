import { z } from "zod";
import { submissionKinds } from "./types";
export const submissionSchema = z
  .object({
    recordId: z.uuid(),
    kind: z.enum(submissionKinds),
    parentId: z.uuid().optional(),
    displayName: z.string().trim().max(60).optional(),
    body: z.string().trim().min(10).max(3000),
    challengeId: z.uuid(),
    answer: z.string().max(10),
    website: z.string().max(200).default(""),
  })
  .strict();
export const moderationSchema = z
  .object({
    action: z.enum(["approve", "reject", "withdraw", "resolve"]),
    reason: z.string().trim().min(10).max(1000),
    version: z.number().int().min(0),
    reviewed: z.boolean().default(false),
  })
  .strict();
export const replySchema = z
  .object({ body: z.string().trim().min(10).max(3000) })
  .strict();
export const settingsSchema = z
  .object({
    commentsEnabled: z.boolean(),
    reminderDays: z.number().int().min(0).max(365),
    version: z.number().int().min(0),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export function spamReason(body: string) {
  if ((body.match(/https?:\/\//gi) || []).length > 2) return "too_many_links";
  if (/(.)\1{14,}/u.test(body)) return "repetitive_content";
  return null;
}
export function allowedPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "web.push.apple.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.services.mozilla.com") ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const pushSchema = z
  .object({
    subscription: z
      .object({
        endpoint: z
          .string()
          .max(2000)
          .refine(allowedPushEndpoint, "Unsupported browser push service."),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({
          p256dh: z
            .string()
            .regex(/^[A-Za-z0-9_-]+$/)
            .refine((s) => Buffer.from(s, "base64url").length === 65),
          auth: z
            .string()
            .regex(/^[A-Za-z0-9_-]+$/)
            .refine((s) => Buffer.from(s, "base64url").length === 16),
        }),
      })
      .strict(),
    recordIds: z.array(z.uuid()).max(200),
  })
  .strict();
