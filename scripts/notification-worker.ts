import { writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPool } from "../src/db";
import { dispatchBatch } from "../src/lib/notifications/dispatcher";
async function main() {
  const healthFile =
    process.env.NOTIFICATION_HEALTH_FILE ||
    join(tmpdir(), "wassa-notification-worker.json");
  if (process.argv.includes("--health")) {
    try {
      const { at, push } = JSON.parse(await readFile(healthFile, "utf8"));
      if (
        !Number.isFinite(at) ||
        Date.now() - at > 300000 ||
        push === "misconfigured"
      )
        process.exitCode = 1;
    } catch {
      process.exitCode = 1;
    }
  } else {
    let stopping = false;
    let previousPush = "";
    process.on("SIGTERM", () => {
      stopping = true;
    });
    process.on("SIGINT", () => {
      stopping = true;
    });
    while (!stopping) {
      try {
        const counts = await dispatchBatch();
        await writeFile(
          healthFile,
          JSON.stringify({ at: Date.now(), push: counts.push }),
        );
        if (counts.events || counts.deliveries || previousPush !== counts.push)
          console.log(JSON.stringify(counts));
        previousPush = counts.push;
        if (process.argv.includes("--once") && counts.push === "misconfigured")
          process.exitCode = 1;
      } catch {
        console.error(
          "Notification dispatcher failed; retrying. No subscriber details logged.",
        );
        if (process.argv.includes("--once")) process.exitCode = 1;
      }
      if (process.argv.includes("--once")) break;
      if (!stopping) await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    await getPool().end();
  }
}
void main().catch(() => {
  console.error("Notification dispatcher could not complete.");
  process.exitCode = 1;
});
