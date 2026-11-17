import { z } from "zod";
import { staffApi } from "@/lib/content/api";
import {
  changeCommenting,
  commentPageNumber,
  dismissReports,
  managedComments,
  moderateComment,
} from "@/lib/comments/service";
import { smallJson } from "@/lib/security/http";

export function GET(request: Request) {
  return staffApi(request, async (actor) => {
    const params = new URL(request.url).searchParams;
    const state = z
      .enum(["visible", "hidden", "reported"])
      .parse(params.get("state") ?? "visible");
    const project = z.string().max(100).nullable().parse(params.get("project"));
    return managedComments(
      actor,
      project,
      state,
      commentPageNumber(params.get("page")),
    );
  });
}
export function PATCH(request: Request) {
  return staffApi(request, async (actor) => {
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.enum(["hide", "restore", "dismiss-reports"]),
            id: z.uuid(),
            version: z.number().int().nonnegative(),
          })
          .strict(),
        z
          .object({
            action: z.literal("set-enabled"),
            id: z.string().min(1).max(100),
            enabled: z.boolean(),
            version: z.number().int().nonnegative(),
          })
          .strict(),
      ])
      .parse(await smallJson(request, 2048));
    if (input.action === "dismiss-reports")
      return dismissReports(actor, input.id, input.version);
    return input.action === "set-enabled"
      ? changeCommenting(actor, input.id, input.enabled, input.version)
      : moderateComment(
          actor,
          input.id,
          input.action === "hide",
          input.version,
        );
  });
}
