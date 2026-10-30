import { getPublicContent } from "@/lib/content/public";
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const record = await getPublicContent(slug);
  return record
    ? Response.json(record, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { message: "Record not available." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
}
