import { NextResponse, type NextRequest } from "next/server";
import { publicRender, publicRenderVersion } from "@/lib/content/render-cache";
const eligible = (path: string) =>
  /^(\/|\/projects|\/projects\/[^/]+|\/information\/[^/]+|\/updates|\/about|\/announcements|\/reports)$/.test(
    path,
  );
export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_PUBLIC_RENDER_CACHE === "false" ||
    request.method !== "GET" ||
    !eligible(request.nextUrl.pathname) ||
    request.headers.has("x-wassa-render") ||
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree") ||
    request.nextUrl.searchParams.has("_rsc")
  )
    return NextResponse.next();
  try {
    const version = await publicRenderVersion(),
      path = request.nextUrl.pathname + request.nextUrl.search,
      key = version + ":" + path;
    const result = await publicRender(key, async () => {
      const port = process.env.PORT || "3000";
      if (!/^\d+$/.test(port)) throw new Error("Invalid internal port");
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { Accept: "text/html", "x-wassa-render": "1" },
        credentials: "omit",
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if ((await publicRenderVersion()) !== version)
        return new Response(null, { status: 409 });
      return response;
    });
    if (result.entry) {
      const headers = new Headers(result.entry.headers);
      headers.set("X-Public-Render-Cache", result.hit ? "hit" : "miss");
      return new NextResponse(new Uint8Array(result.entry.bytes).buffer, {
        headers,
      });
    }
  } catch {
    /* A cache or database failure must fall back to the normal route. */
  }
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/",
    "/projects/:path*",
    "/information/:path*",
    "/updates",
    "/about",
    "/announcements",
    "/reports",
  ],
};
