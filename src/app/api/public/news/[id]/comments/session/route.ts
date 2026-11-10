import { commentSession } from "@/lib/comments/api";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return commentSession(request, (await context.params).id, "news");
}
