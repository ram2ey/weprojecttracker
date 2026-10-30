import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { getDb } from "@/db";
import { staff, staffSession, auditLog } from "@/db/schema";
import { getIdentity } from "@/lib/security/staff-session";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import {
  encrypt,
  decrypt,
  newTotp,
  validateTotp,
  hashToken,
  makeRecoveryCodes,
} from "@/lib/security/crypto";
import { consumeLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  const identity = await getIdentity(request.headers);
  if (!identity) return privateJson({ message: "Sign in to continue." }, 401);
  const input = z
    .object({
      action: z.enum(["enrol", "verify"]),
      code: z.string().max(64).optional(),
    })
    .safeParse(await smallJson(request));
  if (!input.success) return privateJson({ message: "Invalid request." }, 400);
  if (!(await consumeLimit(`mfa:${identity.user.id}`, 8, 900)))
    return privateJson(
      { message: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (input.data.action === "enrol") {
    if (identity.staff.mfaEnabled)
      return privateJson({ message: "MFA is already enabled." }, 409);
    const secret = await getDb().transaction(async (tx) => {
      const [person] = await tx
        .select()
        .from(staff)
        .where(eq(staff.userId, identity.user.id))
        .for("update");
      if (!person.active || person.mfaEnabled) return null;
      const key = person.mfaSecret
        ? decrypt(person.mfaSecret)
        : newTotp(identity.user.email).secret.base32;
      if (!person.mfaSecret)
        await tx
          .update(staff)
          .set({ mfaSecret: encrypt(key) })
          .where(eq(staff.userId, person.userId));
      return key;
    });
    if (!secret)
      return privateJson(
        { message: "Account security changed. Reload this page." },
        409,
      );
    const uri = newTotp(identity.user.email, secret).toString();
    return privateJson({
      secret,
      qr: await QRCode.toDataURL(uri, { margin: 2, width: 240 }),
    });
  }
  const result = await getDb().transaction(async (tx) => {
    const [person] = await tx
      .select()
      .from(staff)
      .where(eq(staff.userId, identity.user.id))
      .for("update");
    if (!person.active || !person.mfaSecret) return null;
    const code = input.data.code?.trim() ?? "";
    const step = validateTotp(
      decrypt(person.mfaSecret),
      code,
      person.mfaLastStep,
    );
    const recoveryIndex = person.mfaEnabled
      ? person.recoveryHashes.indexOf(hashToken(code))
      : -1;
    if (step === null && recoveryIndex === -1) return null;
    const recoveryCodes = person.mfaEnabled ? undefined : makeRecoveryCodes();
    const hashes = recoveryCodes
      ? recoveryCodes.map(hashToken)
      : person.recoveryHashes.filter((_, i) => i !== recoveryIndex);
    await tx
      .update(staff)
      .set({
        mfaEnabled: true,
        mfaLastStep: step ?? person.mfaLastStep,
        recoveryHashes: hashes,
      })
      .where(and(eq(staff.userId, person.userId), eq(staff.active, true)));
    await tx
      .insert(staffSession)
      .values({
        sessionId: identity.session.id,
        userId: person.userId,
        expiresAt: identity.session.expiresAt,
      })
      .onConflictDoUpdate({
        target: staffSession.sessionId,
        set: { verifiedAt: new Date(), expiresAt: identity.session.expiresAt },
      });
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: person.userId,
      action: recoveryCodes
        ? "staff.mfa_enrolled"
        : recoveryIndex >= 0
          ? "staff.mfa_recovery_used"
          : "staff.mfa_verified",
      subjectId: person.userId,
    });
    return { recoveryCodes };
  });
  if (!result)
    return privateJson(
      {
        message:
          "Invalid or already used code. Try the next code from your authenticator.",
      },
      400,
    );
  return privateJson({ ok: true, ...result });
}
