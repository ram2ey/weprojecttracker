import { getAuth } from "@/lib/auth";
import { authConfigured } from "@/lib/env";
const allowed = new Set([
  "sign-in/email",
  "sign-in/social",
  "callback/google",
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
  return getAuth().handler(request);
}
export const GET = handle;
export const POST = handle;
