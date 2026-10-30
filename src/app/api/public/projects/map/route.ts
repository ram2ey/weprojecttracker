import { publicFiltersSchema } from "@/lib/content/filters";
import { publicProjectMap } from "@/lib/content/discovery";
export async function GET(request: Request) {
  const result = publicFiltersSchema.safeParse({
    ...Object.fromEntries(new URL(request.url).searchParams),
    kind: "project",
  });
  if (!result.success)
    return Response.json(
      { message: "Invalid project filters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(await publicProjectMap(result.data), {
    headers: { "Cache-Control": "no-store" },
  });
}
