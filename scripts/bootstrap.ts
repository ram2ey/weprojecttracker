import { config } from "dotenv";
config({ path: ".env.local" });
import { randomBytes } from "node:crypto";
import { getDb, getPool } from "../src/db";
import { user, staff, staffLink, auditLog } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "../src/lib/security/crypto";
import { appUrl, validateRuntime } from "../src/lib/env";
async function main() {
  validateRuntime();
  const email = process.argv[2]?.trim().toLowerCase();
  const name = process.argv[3] ?? "Platform operator";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(
      'Usage: npm run staff:bootstrap -- operator@example.com "Operator name"',
    );
  const db = getDb();
  const existing = await db
    .select()
    .from(staff)
    .where(eq(staff.role, "super_admin"));
  if (existing.length)
    throw new Error(
      "An operator already exists. Use the dashboard for additional staff or the documented recovery procedure.",
    );
  const token = randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id, name, email, emailVerified: true });
    await tx.insert(staff).values({ userId: id, role: "super_admin" });
    await tx.insert(staffLink).values({
      id: crypto.randomUUID(),
      userId: id,
      kind: "setup",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    });
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: id,
      action: "staff.operator_bootstrapped",
      subjectId: id,
    });
  });
  console.log(
    `Operator created. Open this one-use link within one hour. Treat it as a secret:\n${appUrl()}/staff/setup#${token}`,
  );
  await getPool().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
