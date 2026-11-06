import { config } from "dotenv";
if (process.env.CI !== "true") config({ path: ".env.local", quiet: true });
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "../src/db";
import { randomUUID } from "node:crypto";
async function main() {
  const release = process.env.RELEASE_ID;
  if (
    release &&
    release !== "local" &&
    !/^sha-[a-f0-9]{40}-\d+-\d+$/.test(release)
  )
    throw new Error("Invalid release identifier.");
  await migrate(getDb(), { migrationsFolder: "drizzle" });
  if (release && release !== "local") {
    await getPool().query(
      "INSERT INTO audit_log (id,action,subject_id,details) VALUES ($1,'deployment.migrated',$2,$3)",
      [randomUUID(), release, JSON.stringify({ release })],
    );
  }
  console.log("Database migrations applied.");
  await getPool().end();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
