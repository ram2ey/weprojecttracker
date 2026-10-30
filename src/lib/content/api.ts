import { ZodError } from "zod";
import { getIdentity } from "@/lib/security/staff-session";
import { checkOrigin, privateJson } from "@/lib/security/http";
import { ContentError, type Actor } from "./service";
export async function staffApi(
  request: Request,
  handler: (actor: Actor) => Promise<unknown>,
) {
  try {
    if (request.method !== "GET" && !checkOrigin(request))
      return privateJson({ message: "Invalid request origin." }, 403);
    const identity = await getIdentity(request.headers);
    if (!identity?.verified)
      return privateJson(
        { message: "Verified staff access is required." },
        403,
      );
    return privateJson(
      await handler({ id: identity.user.id, role: identity.staff.role }),
    );
  } catch (error) {
    if (error instanceof ContentError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        {
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" "),
        },
        400,
      );
    console.error(
      "Content operation failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return privateJson(
      { message: "The operation could not be completed. Please try again." },
      503,
    );
  }
}
export async function limitedBytes(request: Request, maximum: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maximum)
    throw new ContentError(413, "The request exceeds the file size limit.");
  const reader = request.body?.getReader();
  if (!reader) throw new ContentError(400, "Request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ContentError(413, "The request exceeds the file size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse(
      (await limitedBytes(request, 1024 * 1024)).toString("utf8"),
    );
  } catch (error) {
    if (error instanceof ContentError) throw error;
    throw new ContentError(400, "Invalid JSON request.");
  }
}
