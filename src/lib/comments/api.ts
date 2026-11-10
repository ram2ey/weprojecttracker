import { ZodError } from "zod";
import { ContentError } from "@/lib/content/service";
import { commentPageNumber, listComments, submitComment } from "./service";
import { readCommentGuard, commentCookie, createCommentGuard } from "./guard";
import { appUrl } from "@/lib/env";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { addressBucket } from "@/lib/security/client-address";
import { consumeLimit } from "@/lib/security/rate-limit";

import type { DiscussionKind } from "./service";
async function response(work: () => Promise<unknown>) {
  try {
    return privateJson(await work());
  } catch (error) {
    if (error instanceof ContentError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Invalid comment page." }, 400);
    return privateJson(
      { message: "Comments are temporarily unavailable. Please try again." },
      503,
    );
  }
}
export function getComments(
  request: Request,
  key: string,
  kind: DiscussionKind,
) {
  return response(async () =>
    listComments(
      key,
      commentPageNumber(new URL(request.url).searchParams.get("page")),
      kind,
    ),
  );
}
export function postComment(
  request: Request,
  key: string,
  kind: DiscussionKind,
) {
  return response(async () => {
    if (!checkOrigin(request))
      throw new ContentError(403, "Invalid request origin.");
    const browser = readCommentGuard(request.headers.get("cookie") || "");
    if (!browser)
      throw new ContentError(
        403,
        "Open the comment form again before posting.",
      );
    const raw =
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() === "application/json"
        ? await smallJson(request)
        : null;
    return submitComment(key, browser, raw, kind, addressBucket(request.headers));
  });
}

export async function commentSession(
  request: Request,
  key: string,
  kind: DiscussionKind,
) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  try {
    const page = await listComments(key, 1, kind);
    if (!page.enabled)
      return privateJson(
        { message: "New comments are closed for this discussion." },
        409,
      );
    const response = privateJson({ ready: true });
    if (!readCommentGuard(request.headers.get("cookie") || "")) {
      // Without this, a script could mint a fresh guard (and a fresh
      // per-browser allowance) for every comment.
      const address = addressBucket(request.headers);
      if (
        !(await consumeLimit(
          "comment-guard:" + address.key,
          address.known ? 20 : 60,
          3600,
        ))
      )
        return privateJson(
          { message: "Too many comment forms opened. Please try again later." },
          429,
        );
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
