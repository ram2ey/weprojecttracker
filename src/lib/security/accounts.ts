import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getDb } from "@/db";
import { user, staff, account, session, auditLog } from "@/db/schema";
import { ContentError, type Actor } from "@/lib/content/service";
import { usernameSchema } from "./usernames";
import {
  temporaryPasswordExpiry,
  temporaryPasswordExpired,
} from "./temporary-password";
export async function createStaff(
  actor: Actor | null,
  input: {
    username: string;
    name: string;
  },
) {
  if (actor && actor.role !== "super_admin")
    throw new ContentError(403, "Admin access required.");
  const role = "super_admin" as const;
  const username = usernameSchema.parse(input.username),
    id = crypto.randomUUID(),
    temporaryPassword = randomBytes(18).toString("base64url"),
    password = await hashPassword(temporaryPassword),
    temporaryPasswordExpiresAt = temporaryPasswordExpiry();
  try {
    await getDb().transaction(async (tx) => {
      if (!actor) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(5247761)`);
        const existing = await tx
          .select()
          .from(staff)
          .where(eq(staff.role, "super_admin"));
        if (existing.length)
          throw new ContentError(409, "An admin already exists.");
      }
      await tx.insert(user).values({
        id,
        username,
        name: input.name,
        email: id + "@staff.invalid",
        emailVerified: true,
      });
      await tx.insert(staff).values({
        userId: id,
        role,
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
      });
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        userId: id,
        providerId: "credential",
        password,
      });
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        actorId: actor?.id ?? id,
        subjectId: id,
        action: "staff.created",
        details: { username, role },
      });
    });
  } catch (e) {
    const x = e as { code?: string; cause?: { code?: string } };
    if (x.code === "23505" || x.cause?.code === "23505")
      throw new ContentError(409, "That username already exists.");
    throw e;
  }
  return { id, username, temporaryPassword, temporaryPasswordExpiresAt };
}
export async function manageStaff(
  actor: Actor,
  id: string,
  action: "reset" | "deactivate" | "reactivate" | "revoke",
) {
  if (actor.role !== "super_admin")
    throw new ContentError(403, "Admin access required.");
  const temporaryPassword =
    action === "reset" ? randomBytes(18).toString("base64url") : undefined;
  const password = temporaryPassword
    ? await hashPassword(temporaryPassword)
    : undefined;
  const temporaryPasswordExpiresAt =
    action === "reset" ? temporaryPasswordExpiry() : undefined;
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(5247761)`);
    const [person] = await tx
      .select()
      .from(staff)
      .where(eq(staff.userId, id))
      .for("update");
    if (!person) throw new ContentError(404, "Staff account not found.");
    if (action === "deactivate" && person.role === "super_admin") {
      const operators = await tx
        .select()
        .from(staff)
        .where(and(eq(staff.role, "super_admin"), eq(staff.active, true)));
      if (operators.length <= 1)
        throw new ContentError(
          409,
          "The last active admin cannot be deactivated.",
        );
    }
    if (action === "reset") {
      const [credential] = await tx
        .select()
        .from(account)
        .where(
          and(eq(account.userId, id), eq(account.providerId, "credential")),
        );
      if (credential)
        await tx
          .update(account)
          .set({ password, updatedAt: new Date() })
          .where(eq(account.id, credential.id));
      else
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: id,
          userId: id,
          providerId: "credential",
          password,
        });
    }
    if (action === "reset")
      await tx
        .update(staff)
        .set({ mustChangePassword: true, temporaryPasswordExpiresAt })
        .where(eq(staff.userId, id));
    if (action === "deactivate" || action === "reactivate")
      await tx
        .update(staff)
        .set({ active: action === "reactivate" })
        .where(eq(staff.userId, id));
    // Also invalidate sign-ins whose password verification started before this
    // transaction but whose session has not yet been inserted/deleted.
    await tx
      .update(staff)
      .set({ accessVersion: sql`${staff.accessVersion} + 1` })
      .where(eq(staff.userId, id));
    if (action !== "reactivate")
      await tx.delete(session).where(eq(session.userId, id));
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      subjectId: id,
      action: "staff." + action,
    });
  });
  return { ok: true, temporaryPassword, temporaryPasswordExpiresAt };
}
export async function changeStaffPassword(
  userId: string,
  sessionId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (currentPassword === newPassword)
    throw new ContentError(400, "Choose a different password.");
  await getDb().transaction(async (tx) => {
    const [person] = await tx
      .select()
      .from(staff)
      .where(eq(staff.userId, userId))
      .for("update");
    const [credential] = await tx
      .select()
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      )
      .for("update");
    const [liveSession] = await tx
      .select()
      .from(session)
      .where(and(eq(session.id, sessionId), eq(session.userId, userId)));
    if (!person?.active || !liveSession || liveSession.expiresAt < new Date())
      throw new ContentError(403, "Sign in again.");
    if (temporaryPasswordExpired(person))
      throw new ContentError(
        403,
        "Temporary password expired. Ask another admin to reset it.",
      );
    if (
      !credential?.password ||
      !(await verifyPassword({
        hash: credential.password,
        password: currentPassword,
      }))
    )
      throw new ContentError(400, "The current password is incorrect.");
    await tx
      .update(account)
      .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx
      .update(staff)
      .set({
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        accessVersion: sql`${staff.accessVersion} + 1`,
      })
      .where(eq(staff.userId, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: userId,
      subjectId: userId,
      action: "staff.password_changed",
    });
  });
  return { ok: true };
}
