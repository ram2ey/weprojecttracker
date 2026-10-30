import { publicFiltersSchema } from "@/lib/content/filters";
import { listPublicContent } from "@/lib/content/public";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = publicFiltersSchema.safeParse(Object.fromEntries(params));
  if (!input.success)
    return Response.json(
      { message: "Invalid search filters." },
      { status: 400 },
    );
  return Response.json(await listPublicContent(input.data), {
    headers: { "Cache-Control": "no-store" },
  });
}
