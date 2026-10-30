import { config } from "dotenv";
config({ path: ".env.local" });
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "../src/db";
async function main() {
  await migrate(getDb(), { migrationsFolder: "drizzle" });
  console.log("Database migrations applied.");
  await getPool().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
