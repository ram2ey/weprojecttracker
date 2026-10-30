import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import { contentKinds } from "@/lib/content/types";
import { createRecord, listAdminRecords } from "@/lib/content/service";
export function GET(request: Request) {
  return staffApi(request, async () => {
    const params = new URL(request.url).searchParams;
    return listAdminRecords({
      kind: z
        .enum(contentKinds)
        .optional()
        .parse(params.get("kind") ?? undefined),
      pending: params.get("pending") === "true",
      page: z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(params.get("page") ?? 1),
    });
  });
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    const input = z
      .object({
        kind: z.enum(contentKinds),
        title: z.string().trim().min(3).max(160),
      })
      .strict()
      .parse(await jsonBody(request));
    return createRecord(actor, input.kind, input.title);
  });
}
