import { databaseConfigured, databaseUrl } from "./database-url";
export function isDesignPreview() {
  return (
    process.env.APP_ENV !== "production" &&
    (process.env.ENABLE_DESIGN_PREVIEW === "true" ||
      (process.env.NODE_ENV === "development" &&
        process.env.ENABLE_DESIGN_PREVIEW !== "false"))
  );
}
export function authConfigured() {
  return Boolean(
    databaseConfigured() &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.MFA_ENCRYPTION_KEY,
  );
}
export function appUrl() {
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
}
export function validateRuntime() {
  if (!authConfigured())
    throw new Error(
      "Database, authentication secret and MFA encryption key must be configured.",
    );
  databaseUrl();
  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32)
    throw new Error("Authentication secret must have at least 32 characters.");
  if (!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY ?? ""))
    throw new Error("MFA encryption key must be 32 bytes in hexadecimal.");
  if (process.env.APP_ENV === "production") {
    if (!appUrl().startsWith("https://"))
      throw new Error("Production requires HTTPS.");
    if (process.env.ENABLE_DESIGN_PREVIEW === "true")
      throw new Error("Design preview must be disabled in production.");
  }
}
