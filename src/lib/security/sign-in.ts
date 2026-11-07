import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { session, staff, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { checkOrigin, privateJson, smallJson } from "./http";
import { temporaryPasswordExpired } from "./temporary-password";

export async function signInStaff(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  const input = await smallJson(request);
  if (!input || typeof input !== "object" || Array.isArray(input))
    return privateJson({ message: "Invalid sign-in request." }, 400);
  const username =
    "username" in input && typeof input.username === "string"
      ? input.username.toLowerCase()
      : "";
  const db = getDb();
  try {
    // Snapshot before Better Auth reads/verifies the credential. Every reset,
    // password change and access-revocation operation increments this counter.
    const [before] = await db
      .select({ userId: staff.userId, version: staff.accessVersion })
      .from(staff)
      .innerJoin(user, eq(user.id, staff.userId))
      .where(eq(user.username, username));
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("content-type", "application/json");
    const response = await getAuth().handler(
      new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      }),
    );
    if (!response.ok) return response;
    const body = (await response.clone().json()) as {
      token?: string;
      user?: { id?: string };
    };
    const person =
      before &&
      (await db.query.staff.findFirst({
        where: eq(staff.userId, before.userId),
      }));
    if (
      !before ||
      !person?.active ||
      person.accessVersion !== before.version ||
      body.user?.id !== before.userId ||
      temporaryPasswordExpired(person)
    ) {
      if (body.token && body.user?.id)
        await db
          .delete(session)
          .where(
            and(
              eq(session.token, body.token),
              eq(session.userId, body.user.id),
            ),
          );
      // Return no Set-Cookie headers or token from the stale sign-in.
      return privateJson(
        {
          message:
            "Your account changed while signing in. Please sign in again.",
        },
        403,
      );
    }
    // The session exists before this check. Later revocations therefore delete
    // it normally; earlier revocations are caught by the version comparison.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return privateJson(
      { message: "Unable to sign in. Please try again." },
      503,
    );
  }
}
