import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { user, staff, staffLink, auditLog } from "@/db/schema";
import { getIdentity } from "@/lib/security/staff-session";
import { canManageStaff } from "@/lib/security/policy";
import { hashToken } from "@/lib/security/crypto";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";
import { appUrl } from "@/lib/env";

export async function POST(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  const actor = await getIdentity(request.headers);
  if (!actor?.verified || !canManageStaff(actor.staff.role))
    return privateJson({ message: "Operator access required." }, 403);
  if (!(await consumeLimit(`staff-links:${actor.user.id}`, 20, 3600)))
    return privateJson(
      { message: "Link creation limit reached. Try again later." },
      429,
    );
  const input = z
    .object({
      name: z.string().min(2).max(100),
      email: z.email().transform((e) => e.toLowerCase().trim()),
      role: z.enum(["officer", "approver"]),
      kind: z.enum(["setup", "reset"]),
    })
    .safeParse(await smallJson(request));
  if (!input.success)
    return privateJson(
      { message: "Enter a name, valid email, and staff role." },
      400,
    );
  const data = input.data;
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + (data.kind === "setup" ? 24 : 1) * 3600000,
  );
  const created = await getDb().transaction(async (tx) => {
    let person = await tx.query.user.findFirst({
      where: eq(user.email, data.email),
    });
    if (data.kind === "setup" && person) return false;
    if (data.kind === "reset" && !person) return false;
    if (!person) {
      [person] = await tx
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          name: data.name,
          email: data.email,
          emailVerified: true,
        })
        .returning();
      await tx.insert(staff).values({ userId: person.id, role: data.role });
    }
    // A new link invalidates earlier links. Password recovery does not disable MFA.
    await tx
      .update(staffLink)
      .set({ usedAt: new Date() })
      .where(eq(staffLink.userId, person.id));
    await tx.insert(staffLink).values({
      id: crypto.randomUUID(),
      userId: person.id,
      tokenHash: hashToken(rawToken),
      kind: data.kind,
      expiresAt,
      createdBy: actor.user.id,
    });
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: actor.user.id,
      subjectId: person.id,
      action: `staff.${data.kind}_link_created`,
    });
    return true;
  });
  if (!created)
    return privateJson(
      {
        message:
          data.kind === "setup"
            ? "An account already exists. Use recovery instead."
            : "No authorised account matches that email.",
      },
      409,
    );
  // Put the secret in the URL fragment so it is not included in access logs or Referer headers.
  return privateJson({
    url: `${appUrl()}/staff/setup#${rawToken}`,
    expiresAt: expiresAt.toISOString(),
  });
}
