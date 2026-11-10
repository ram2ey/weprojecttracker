import { getComments, postComment } from "@/lib/comments/api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return getComments(request, (await context.params).id, "news");
}
export async function POST(request: Request, context: Context) {
  return postComment(request, (await context.params).id, "news");
}
