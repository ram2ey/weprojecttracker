import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { eq } from "drizzle-orm";
import { getDb, getPool } from "../src/db";
import { user, staff } from "../src/db/schema";
import { manageStaff } from "../src/lib/security/accounts";
async function main() {
  const people = await getDb()
    .select({
      id: user.id,
      username: user.username,
      role: staff.role,
      active: staff.active,
    })
    .from(user)
    .innerJoin(staff, eq(staff.userId, user.id));
  const username = process.argv[2];
  if (!username) {
    for (const p of people)
      console.log(
        p.username +
          " · " +
          p.role +
          " · " +
          (p.active ? "active" : "inactive"),
      );
  } else {
    const p = people.find((p) => p.username === username.toLowerCase());
    if (!p || p.role !== "super_admin")
      throw Error(
        "Use the Staff screen for non-operator accounts. Supply an existing operator username for maintenance recovery.",
      );
    const r = await manageStaff(
      { id: p.id, role: "super_admin" },
      p.id,
      "reset",
    );
    console.log(
      "Operator: " +
        p.username +
        "\nTemporary password (shown once): " +
        r.temporaryPassword +
        "\nExpires: " +
        r.temporaryPasswordExpiresAt?.toISOString(),
    );
  }
  await getPool().end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
