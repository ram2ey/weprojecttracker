import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { authConfigured } from "@/lib/env";
import { getDb } from "@/db";
import { staff, staffSession } from "@/db/schema";
import { hasAdministrativeAccess } from "./policy";

export async function getIdentity(requestHeaders: Headers) {
  if (!authConfigured()) return null;
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const person = await getDb().query.staff.findFirst({
    where: eq(staff.userId, result.user.id),
  });
  if (!person?.active) return null;
  const proof = await getDb().query.staffSession.findFirst({
    where: eq(staffSession.sessionId, result.session.id),
  });
  return {
    ...result,
    staff: person,
    verified: hasAdministrativeAccess({
      active: person.active,
      mfaEnabled: person.mfaEnabled,
      proofExpiresAt: proof?.userId === result.user.id ? proof.expiresAt : null,
    }),
  };
}
export async function requireStaff() {
  const identity = await getIdentity(await headers());
  if (!identity) redirect("/staff/login");
  if (!identity.verified) redirect("/staff/security");
  return identity;
}
