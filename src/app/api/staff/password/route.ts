import { z } from "zod";
import { getIdentity } from "@/lib/security/staff-session";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { passwordSchema } from "@/lib/security/usernames";
import { changeStaffPassword } from "@/lib/security/accounts";
import { consumeLimit } from "@/lib/security/rate-limit";
import { ContentError } from "@/lib/content/service";
export async function POST(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  try {
    const identity = await getIdentity(request.headers);
    if (!identity) return privateJson({ message: "Sign in first." }, 403);
    if (!(await consumeLimit("password:" + identity.user.id, 8)))
      return privateJson(
        { message: "Too many attempts. Try again later." },
        429,
      );
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: passwordSchema,
      })
      .strict()
      .parse(await smallJson(request));
    return privateJson(
      await changeStaffPassword(
        identity.user.id,
        identity.session.id,
        input.currentPassword,
        input.newPassword,
      ),
    );
  } catch (e) {
    if (e instanceof ContentError)
      return privateJson({ message: e.message }, e.status);
    if (e instanceof z.ZodError)
      return privateJson(
        { message: "Use a password of 12–128 characters." },
        400,
      );
    return privateJson(
      { message: "Unable to change the password. Try again." },
      503,
    );
  }
}
