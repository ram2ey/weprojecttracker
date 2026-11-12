import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createStaff } from "../src/lib/security/accounts";
import { getPool } from "../src/db";
import { validateRuntime } from "../src/lib/env";
async function main() {
  validateRuntime();
  const username = process.argv[2],
    name = process.argv[3] ?? "Platform admin";
  if (!username)
    throw new Error('Usage: npm run staff:bootstrap -- admin "Admin name"');
  const result = await createStaff(null, { username, name });
  console.log(
    "Admin username: " +
      result.username +
      "\nTemporary password (shown once): " +
      result.temporaryPassword +
      "\nExpires: " +
      result.temporaryPasswordExpiresAt.toISOString() +
      "\nSign in at /staff/login and choose a new password.",
  );
  await getPool().end();
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
