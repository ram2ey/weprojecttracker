import webpush from "web-push";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
// Local-only output is ignored by Git. Nothing is enabled or sent by this utility.
const path = ".local/vapid.env";
if (existsSync(path))
  throw new Error(
    "Local VAPID key file already exists; preserve it to avoid invalidating browser subscriptions.",
  );
mkdirSync(".local", { recursive: true });
const keys = webpush.generateVAPIDKeys();
writeFileSync(
  path,
  `ENABLE_BROWSER_PUSH=false\nVAPID_SUBJECT=\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`,
  { mode: 0o600 },
);
console.log(
  "Local VAPID keys saved to .local/vapid.env. Live delivery remains disabled.",
);
