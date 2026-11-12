import { pathToFileURL } from "node:url";
import { smokePublicApp } from "./public-smoke.mjs";

export async function monitor(origin, { requireBackup = false } = {}) {
  const ready = await smokePublicApp(origin, { full: false });
  if (
    !/^sha-[a-f0-9]{40}-\d+-\d+$/.test(ready.release || "") ||
    ready.migrated !== true
  )
    throw new Error(
      "The hosted release has no matching migration-success marker.",
    );
  // "none" means backups were never configured; only an alert once required.
  if (ready.backup === "stale" || (requireBackup && ready.backup !== "ok"))
    throw new Error(
      ready.backup === "stale"
        ? "The last successful nightly backup is more than 36 hours old."
        : "No successful nightly backup has been recorded.",
    );
  return ready;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const ready = await monitor(process.env.PUBLIC_APP_URL, {
      requireBackup: process.env.REQUIRE_BACKUP === "true",
    });
    console.log(
      "Public register and migrated release are reachable. Backup: " +
        (ready.backup ?? "unknown") +
        ".",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
