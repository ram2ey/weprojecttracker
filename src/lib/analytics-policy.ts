export const consentCookie = "wassa_cookie_consent";
export type Consent = "unknown" | "accepted" | "rejected";
export function readConsent(cookies: string): Consent {
  const value = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(consentCookie + "="))
    ?.slice(consentCookie.length + 1);
  return value === "v1.accepted"
    ? "accepted"
    : value === "v1.rejected"
      ? "rejected"
      : "unknown";
}
export function analyticsPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Do not accept URLs, queries, fragments, encoded paths or private routes.
  if (["/", "/projects", "/about", "/contact", "/privacy"].includes(value))
    return value;
  return /^\/projects\/[a-z0-9][a-z0-9-]{0,159}$/.test(value) ? value : null;
}
