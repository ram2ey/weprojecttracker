import {
  commentCookie,
  createCommentGuard,
  readCommentGuard,
} from "@/lib/comments/guard";
import { listComments } from "@/lib/comments/service";
import { ContentError } from "@/lib/content/service";
import { checkOrigin, privateJson } from "@/lib/security/http";
import { appUrl } from "@/lib/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  try {
    const page = await listComments((await context.params).slug);
    if (!page.enabled)
      return privateJson(
        { message: "New comments are closed for this project." },
        409,
      );
    const response = privateJson({ ready: true });
    if (!readCommentGuard(request.headers.get("cookie") || "")) {
      response.headers.append(
        "Set-Cookie",
        `${commentCookie}=${createCommentGuard()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(appUrl()).protocol === "https:" ? "; Secure" : ""}`,
      );
    }
    return response;
  } catch (error) {
    return privateJson(
      {
        message:
          error instanceof ContentError
            ? error.message
            : "The comment form is temporarily unavailable. Please try again.",
      },
      error instanceof ContentError ? error.status : 503,
    );
  }
}
