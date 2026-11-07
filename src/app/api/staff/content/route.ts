import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { createRecord, listAdminRecords } from "@/lib/content/service";
export function GET(request: Request) {
  return staffApi(request, async () => {
    const p = new URL(request.url).searchParams;
    return listAdminRecords({
      q: z
        .string()
        .max(200)
        .parse(p.get("q") ?? ""),
      pending: p.get("pending") === "true",
      page: z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(p.get("page") ?? 1),
    });
  });
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    const input = z
      .object({
        kind: z.literal("project"),
        title: z.string().trim().min(3).max(160),
      })
      .strict()
      .parse(await jsonBody(request));
    return createRecord(actor, input.kind, input.title);
  });
}
