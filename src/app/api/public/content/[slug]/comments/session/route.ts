import { commentSession } from "@/lib/comments/api";
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return commentSession(request, (await context.params).slug, "project");
}
