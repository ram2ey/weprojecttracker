import { getAuth } from "@/lib/auth";
import { authConfigured } from "@/lib/env";
import { signInStaff } from "@/lib/security/sign-in";
const allowed = new Set([
  "sign-in/username",
  "sign-out",
  "get-session",
  "error",
  "ok",
]);
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (!allowed.has(path))
    return Response.json({ message: "Endpoint unavailable." }, { status: 404 });
  if (!authConfigured())
    return Response.json(
      { message: "Staff access is awaiting server configuration." },
      { status: 503 },
    );
  if (path === "sign-in/username" && request.method === "POST")
    return signInStaff(request);
  const response = await getAuth().handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const GET = handle;
export const POST = handle;
