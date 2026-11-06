import { pathToFileURL } from "node:url";
import { smokePublicApp } from "./public-smoke.mjs";

export async function monitor(origin) {
  const ready = await smokePublicApp(origin, { full: false });
  if (
    !/^sha-[a-f0-9]{40}-\d+-\d+$/.test(ready.release || "") ||
    ready.migrated !== true
  )
    throw new Error(
      "The hosted release has no matching migration-success marker.",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await monitor(process.env.PUBLIC_APP_URL);
    console.log("Public register and migrated release are reachable.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
