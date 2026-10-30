import { z } from "zod";
import { staffApi } from "@/lib/content/api";
import { listModeration } from "@/lib/engagement/service";
export function GET(request: Request) {
  return staffApi(request, async () => {
    const params = new URL(request.url).searchParams;
    const input = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        state: z
          .enum([
            "all",
            "pending",
            "approved",
            "rejected",
            "withdrawn",
            "resolved",
          ])
          .default("pending"),
        kind: z
          .enum(["all", "comment", "feedback", "correction", "report"])
          .default("all"),
      })
      .parse(Object.fromEntries(params));
    return listModeration(input.page, input.state, input.kind);
  });
}
