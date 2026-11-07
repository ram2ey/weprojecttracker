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
  return Boolean(databaseConfigured() && process.env.BETTER_AUTH_SECRET);
}
export function appUrl() {
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
}
export function validateRuntime() {
  if (!authConfigured())
    throw new Error("Database and authentication secret must be configured.");
  databaseUrl();
  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32)
    throw new Error("Authentication secret must have at least 32 characters.");
  if (process.env.APP_ENV === "production") {
    if (!appUrl().startsWith("https://"))
      throw new Error("Production requires HTTPS.");
    if (process.env.ENABLE_DESIGN_PREVIEW === "true")
      throw new Error("Design preview must be disabled in production.");
  }
}
