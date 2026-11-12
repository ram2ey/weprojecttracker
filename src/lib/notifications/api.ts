import { z, ZodError } from "zod";
import { appUrl } from "@/lib/env";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";
import { addressBucket } from "@/lib/security/client-address";
import {
  cookieToken,
  deviceCookie,
  deviceDays,
  followSchema,
  pushConfiguration,
  subscriptionSchema,
} from "./policy";
import {
  deleteDevice,
  followEverything,
  followTopic,
  inbox,
  markRead,
  NotificationError,
  removeSubscription,
  saveSubscription,
  unfollowTopic,
} from "./service";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("follow"), follow: followSchema }).strict(),
  z.object({ action: z.literal("follow-all") }).strict(),
  z.object({ action: z.literal("unfollow"), follow: followSchema }).strict(),
  z
    .object({
      action: z.literal("subscribe"),
      subscription: subscriptionSchema,
    })
    .strict(),
  z.object({ action: z.literal("unsubscribe") }).strict(),
  z
    .object({
      action: z.literal("read"),
      ids: z.array(z.uuid()).max(50).default([]),
      before: z.iso.datetime().optional(),
    })
    .strict(),
]);
function cookie(value: string, days: number) {
  return `${deviceCookie}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${days * 86400}${new URL(appUrl()).protocol === "https:" ? "; Secure" : ""}`;
}
function availablePush() {
  try {
    return pushConfiguration();
  } catch {
    return { enabled: false as const };
  }
}
export async function notificationsApi(request: Request) {
  try {
    if (request.method !== "GET" && !checkOrigin(request))
      throw new NotificationError(403, "Invalid request origin.");
    const address = addressBucket(request.headers);
    if (
      !(await consumeLimit(
        "notifications:" + request.method + ":" + address.key,
        request.method === "GET" ? 240 : 120,
        60,
      ))
    )
      throw new NotificationError(
        429,
        "Too many requests. Please try again shortly.",
      );
    const token = cookieToken(request.headers.get("cookie") || "");
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const view = z
        .enum(["all", "for-you"])
        .parse(params.get("view") ?? "for-you");
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(params.get("page") ?? 1);
      const config = availablePush();
      return privateJson({
        ...(await inbox(token, view, page)),
        push: config.enabled
          ? { enabled: true, publicKey: config.publicKey }
          : { enabled: false },
      });
    }
    if (request.method === "DELETE") {
      if (token) await deleteDevice(token);
      const response = privateJson({ ok: true });
      response.headers.set("Set-Cookie", cookie("", 0));
      return response;
    }
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      throw new NotificationError(415, "Send a JSON request.");
    const input = mutation.parse(await smallJson(request));
    if (input.action === "follow" || input.action === "follow-all") {
      const { createdToken } =
        input.action === "follow"
          ? await followTopic(token, input.follow)
          : await followEverything(token);
      const response = privateJson({ ok: true });
      if (createdToken)
        response.headers.set("Set-Cookie", cookie(createdToken, deviceDays));
      return response;
    }
    if (!token)
      throw new NotificationError(401, "Follow a project or topic first.");
    if (input.action === "unfollow") await unfollowTopic(token, input.follow);
    if (input.action === "unsubscribe") await removeSubscription(token);
    if (input.action === "subscribe") {
      if (!availablePush().enabled)
        throw new NotificationError(
          503,
          "Phone alerts are not available yet. Your inbox still works.",
        );
      await saveSubscription(token, input.subscription);
    }
    if (input.action === "read") await markRead(token, input.ids, input.before);
    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof NotificationError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Invalid notification request." }, 400);
    if ((error as { code?: string }).code === "23505")
      return privateJson(
        { message: "This subscription is already registered." },
        409,
      );
    return privateJson(
      { message: "Updates are temporarily unavailable. Please try again." },
      503,
    );
  }
}
