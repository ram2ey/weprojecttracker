export function GET() {
  return Response.json(
    { status: "ok", service: "wassa-east-projects" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
