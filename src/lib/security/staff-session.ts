import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { authConfigured } from "@/lib/env";
import { getDb } from "@/db";
import { staff } from "@/db/schema";
import { temporaryPasswordExpired } from "./temporary-password";
export async function getIdentity(requestHeaders: Headers) {
  if (!authConfigured()) return null;
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const person = await getDb().query.staff.findFirst({
    where: eq(staff.userId, result.user.id),
  });
  if (!person?.active || temporaryPasswordExpired(person)) return null;
  return { ...result, staff: person, verified: !person.mustChangePassword };
}
export async function requireStaff() {
  const identity = await getIdentity(await headers());
  if (!identity) redirect("/staff/login");
  if (!identity.verified) redirect("/staff/password");
  return identity;
}
