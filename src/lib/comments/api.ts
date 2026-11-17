import { z, ZodError } from "zod";
import { ContentError } from "@/lib/content/service";
import {
  commentPageNumber,
  listComments,
  reportComment,
  submitComment,
} from "./service";
import { reportInput } from "./policy";
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
    return submitComment(
      key,
      browser,
      raw,
      kind,
      addressBucket(request.headers),
    );
  });
}

// Returns this browser's guard id, minting a new guard cookie when needed.
// Without the address limit, a script could mint a fresh guard (and a fresh
// per-browser allowance) for every request.
async function browserGuard(request: Request) {
  const existing = readCommentGuard(request.headers.get("cookie") || "");
  if (existing) return { browser: existing, cookie: null };
  const address = addressBucket(request.headers);
  if (
    !(await consumeLimit(
      "comment-guard:" + address.key,
      address.known ? 20 : 60,
      3600,
    ))
  )
    throw new ContentError(
      429,
      "Too many comment forms opened. Please try again later.",
    );
  const guard = createCommentGuard();
  return {
    browser: guard.split(".")[0],
    cookie: `${commentCookie}=${guard}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(appUrl()).protocol === "https:" ? "; Secure" : ""}`,
  };
}

export async function postReport(request: Request, commentId: string) {
  let cookie: string | null = null;
  const result = await response(async () => {
    if (!checkOrigin(request))
      throw new ContentError(403, "Invalid request origin.");
    if (!z.uuid().safeParse(commentId).success)
      throw new ContentError(404, "This comment is no longer available.");
    const raw =
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() === "application/json"
        ? await smallJson(request, 1024)
        : null;
    const parsed = reportInput.safeParse(raw ?? {});
    if (!parsed.success) throw new ContentError(400, "Choose a valid reason.");
    const guard = await browserGuard(request);
    cookie = guard.cookie;
    const address = addressBucket(request.headers);
    if (
      !(await consumeLimit(
        "comment-report:" + address.key,
        address.known ? 30 : 120,
        3600,
      )) ||
      !(await consumeLimit("comment-report-browser:" + guard.browser, 20, 3600))
    )
      throw new ContentError(
        429,
        "Too many reports from this device. Please try again later.",
      );
    return reportComment(commentId, guard.browser, parsed.data);
  });
  if (cookie) result.headers.append("Set-Cookie", cookie);
  return result;
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
    const { cookie } = await browserGuard(request);
    if (cookie) response.headers.append("Set-Cookie", cookie);
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
