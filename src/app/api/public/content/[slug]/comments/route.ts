import { ZodError } from "zod";
import { ContentError } from "@/lib/content/service";
import {
  commentPageNumber,
  listComments,
  submitComment,
} from "@/lib/comments/service";
import { readCommentGuard } from "@/lib/comments/guard";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";

type Context = { params: Promise<{ slug: string }> };
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
export function GET(request: Request, context: Context) {
  return response(async () =>
    listComments(
      (await context.params).slug,
      commentPageNumber(new URL(request.url).searchParams.get("page")),
    ),
  );
}
export function POST(request: Request, context: Context) {
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
    return submitComment((await context.params).slug, browser, raw);
  });
}
