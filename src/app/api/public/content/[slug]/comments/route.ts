import { getComments, postComment } from "@/lib/comments/api";
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, context: Context) {
  return getComments(request, (await context.params).slug, "project");
}
export async function POST(request: Request, context: Context) {
  return postComment(request, (await context.params).slug, "project");
}
