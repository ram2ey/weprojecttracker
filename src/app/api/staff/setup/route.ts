import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb } from "@/db";
import {
  user,
  staff,
  staffLink,
  account,
  session,
  auditLog,
} from "@/db/schema";
import { hashToken } from "@/lib/security/crypto";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";
import { authConfigured } from "@/lib/env";

export async function POST(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  if (!authConfigured())
    return privateJson({ message: "Staff access is not configured." }, 503);
  const input = z
    .object({
      token: z.string().min(32).max(128),
      password: z.string().min(12).max(128),
    })
    .safeParse(await smallJson(request));
  if (!input.success)
    return privateJson(
      {
        message:
          "Enter a valid setup link and a password of 12-128 characters.",
      },
      400,
    );
  const tokenHash = hashToken(input.data.token);
  if (!(await consumeLimit(`setup:${tokenHash}`, 8)))
    return privateJson({ message: "Too many attempts. Try again later." }, 429);
  const validLink = await getDb().query.staffLink.findFirst({
    where: eq(staffLink.tokenHash, tokenHash),
  });
  if (!validLink || validLink.usedAt || validLink.expiresAt < new Date())
    return privateJson(
      {
        message:
          "This link is invalid, expired, or already used. Contact the operator.",
      },
      400,
    );
  const password = await hashPassword(input.data.password);
  const ok = await getDb().transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(staffLink)
      .where(eq(staffLink.id, validLink.id))
      .for("update");
    if (link.usedAt || link.expiresAt < new Date()) return false;
    const [person] = await tx
      .select()
      .from(staff)
      .where(eq(staff.userId, link.userId));
    if (!person?.active) return false;
    const [existing] = await tx
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, link.userId),
          eq(account.providerId, "credential"),
        ),
      );
    if (existing)
      await tx
        .update(account)
        .set({ password, updatedAt: new Date() })
        .where(eq(account.id, existing.id));
    else
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: link.userId,
        providerId: "credential",
        userId: link.userId,
        password,
      });
    await tx
      .update(staffLink)
      .set({ usedAt: new Date() })
      .where(eq(staffLink.id, link.id));
    await tx
      .update(user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, link.userId));
    await tx.delete(session).where(eq(session.userId, link.userId));
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: link.userId,
      action: `staff.${link.kind}_redeemed`,
      subjectId: link.userId,
    });
    return true;
  });
  return ok
    ? privateJson({ ok: true })
    : privateJson({ message: "This link is no longer valid." }, 400);
}
