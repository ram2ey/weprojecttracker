import { z } from "zod";
import { eq } from "drizzle-orm";
import { staffApi, jsonBody } from "@/lib/content/api";
import { ContentError } from "@/lib/content/service";
import { getDb } from "@/db";
import { user, staff } from "@/db/schema";
import { createStaff, manageStaff } from "@/lib/security/accounts";
import { usernameSchema } from "@/lib/security/usernames";
import { consumeLimit } from "@/lib/security/rate-limit";
export function GET(request: Request) {
  return staffApi(request, async (actor) => {
    if (actor.role !== "super_admin")
      throw new ContentError(403, "Operator access required.");
    return getDb()
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        role: staff.role,
        active: staff.active,
        mustChangePassword: staff.mustChangePassword,
      })
      .from(staff)
      .innerJoin(user, eq(user.id, staff.userId))
      .orderBy(user.username);
  });
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    if (actor.role !== "super_admin")
      throw new ContentError(403, "Operator access required.");
    if (!(await consumeLimit("accounts:" + actor.id, 30, 3600)))
      throw new ContentError(429, "Too many account changes. Try again later.");
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("create"),
            username: usernameSchema,
            name: z.string().trim().min(2).max(100),
            role: z.enum(["officer", "approver"]),
          })
          .strict(),
        z
          .object({
            action: z.enum(["reset", "deactivate", "reactivate", "revoke"]),
            id: z.string().min(1).max(128),
          })
          .strict(),
      ])
      .parse(await jsonBody(request));
    return input.action === "create"
      ? createStaff(actor, input)
      : manageStaff(actor, input.id, input.action);
  });
}
