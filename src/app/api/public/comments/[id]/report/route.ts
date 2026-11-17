import { postReport } from "@/lib/comments/api";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return postReport(request, (await context.params).id);
}
