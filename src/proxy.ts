import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/security/csp";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const headers = new Headers(request.headers);
  // Ignore caller-supplied nonces before Next extracts the rendering nonce.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    // .well-known/assetlinks.json must reach Google's verifier as plain JSON.
    "/((?!api(?:/|$)|_next/|brand/|\\.well-known/|(?:notification-)?sw\\.js$|offline\\.html$|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
