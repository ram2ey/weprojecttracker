import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

// Pure validation: never opens a database, loads development secrets, or prints values.
export function checkDeployment(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const url = new URL(env.APP_URL ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.includes(".") ||
      /(^localhost$|\.(localhost|local|test|invalid|example)$)/i.test(
        url.hostname,
      )
    )
      throw new Error();
  } catch {
    errors.push(
      "APP_URL must be a public HTTPS origin without credentials, a port, path, query or fragment.",
    );
  }
  for (const key of ["WEB_IMAGE", "TOOLS_IMAGE"]) {
    const image = env[key] ?? "";
    const digest = /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/;
    const tagged = /^[a-z0-9][a-z0-9./:_-]*:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
    const tag = image.slice(image.lastIndexOf(":") + 1);
    if (
      !image.includes("/") ||
      !(digest.test(image) || tagged.test(image)) ||
      /^(latest|local|dev|development|main|master|production|stable)$/i.test(
        tag,
      )
    )
      errors.push(
        `${key} must reference a registry image with a release-specific tag or sha256 digest.`,
      );
    else if (!image.includes("@sha256:"))
      warnings.push(
        `${key} uses a tag. Keep release tags immutable, or pin the published image digest.`,
      );
  }
  for (const key of ["POSTGRES_PASSWORD", "BETTER_AUTH_SECRET"]) {
    if (
      (env[key]?.length ?? 0) < 32 ||
      /change.?me|replace.?me|your[_ -].*secret/i.test(env[key] ?? "")
    )
      errors.push(
        `${key} must be an independently generated production secret of at least 32 characters.`,
      );
  }
  if (env.POSTGRES_PASSWORD && env.POSTGRES_PASSWORD === env.BETTER_AUTH_SECRET)
    errors.push("Database and authentication secrets must be different.");
  if (env.APP_ENV && env.APP_ENV !== "production")
    errors.push("APP_ENV cannot override the production environment.");
  for (const key of ["ENABLE_DESIGN_PREVIEW", "ENABLE_BROWSER_PUSH"])
    if (env[key] && env[key] !== "false")
      errors.push(`${key} must stay disabled in this deployment.`);
  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--env-file"))
    throw new Error(
      "Usage: npm run deploy:check -- [--env-file .env.production.local]",
    );
  // An explicit file is checked in isolation. Never merge in .env.local.
  const env = args.length ? parse(readFileSync(resolve(args[1]))) : process.env;
  const { errors, warnings } = checkDeployment(env);
  for (const error of errors) console.error(`ERROR: ${error}`);
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (errors.length) process.exitCode = 1;
  else
    console.log(
      "Production configuration checks passed. Linux images, HTTPS, volumes and production workflows still need verification.",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch {
    console.error(
      "Could not read deployment configuration. Use --env-file with an existing private environment file.",
    );
    process.exitCode = 1;
  }
}
