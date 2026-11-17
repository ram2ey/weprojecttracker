import { assetLinks } from "@/lib/app-mode";

// Read at request time so Coolify environment changes apply without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  const links = assetLinks();
  if (!links) {
    if (
      process.env.ANDROID_PACKAGE_NAME ||
      process.env.ANDROID_CERT_FINGERPRINTS
    )
      console.error(
        "assetlinks.json: ANDROID_PACKAGE_NAME or ANDROID_CERT_FINGERPRINTS is invalid.",
      );
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json(links, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
