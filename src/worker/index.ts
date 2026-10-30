import { config } from "dotenv";
config({ path: ".env.local" });
import { PgBoss } from "pg-boss";
import { getPool } from "../db";
import { validateRuntime } from "../lib/env";
import { databaseUrl } from "../lib/database-url";
import { runMaintenance, runReminders } from "./maintenance";
import { dispatchPush } from "../lib/engagement/push";
async function main() {
  validateRuntime();
  const boss = new PgBoss({
    connectionString: databaseUrl(),
    max: 2,
  });
  boss.on("error", (error) => console.error("Worker failure:", error.message));
  await boss.start();
  await boss.createQueue("maintenance");
  await boss.work("maintenance", async () => {
    await runMaintenance();
  });
  await boss.schedule("maintenance", "17 2 * * *", {}, { tz: "UTC" });
  await boss.createQueue("inbox-reminders");
  await boss.work("inbox-reminders", async () => {
    await runReminders();
  });
  await boss.schedule("inbox-reminders", "*/5 * * * *", {}, { tz: "UTC" });
  await boss.createQueue("browser-push");
  await boss.work("browser-push", async () => {
    await dispatchPush();
  });
  await boss.schedule("browser-push", "* * * * *", {}, { tz: "UTC" });
  console.log("Background worker ready.");
  const stop = async () => {
    await boss.stop();
    await getPool().end();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
