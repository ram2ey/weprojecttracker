import { lookup } from "node:dns";
import { request, Agent } from "node:https";
import ipaddr from "ipaddr.js";
import webpush from "web-push";
import {
  allowedEndpoint,
  pushConfiguration,
  type Subscription,
} from "./policy";

export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
// Resolve and validate the very addresses used by the socket (no DNS rebind gap).
const agent = new Agent({
  lookup(hostname, options, callback) {
    lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error, "", 4);
      if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
        return callback(new Error("Push address is not public"), "", 4);
      const eligible = options.family
        ? addresses.filter((a) => a.family === options.family)
        : addresses;
      if (!eligible.length)
        return callback(new Error("No push address available"), "", 4);
      if (options.all) callback(null, eligible);
      else callback(null, eligible[0].address, eligible[0].family);
    });
  },
});
export type SendResult = { status: number; retryAfter?: string };
export async function sendPush(
  subscription: Subscription,
  payload: string,
): Promise<SendResult> {
  if (!allowedEndpoint(subscription.endpoint))
    throw new Error("Unsupported push endpoint");
  const config = pushConfiguration();
  if (!config.enabled) throw new Error("Push delivery disabled");
  const details = webpush.generateRequestDetails(subscription, payload, {
    TTL: 3600,
    urgency: "normal",
    vapidDetails: {
      subject: config.subject,
      publicKey: config.publicKey,
      privateKey: config.privateKey,
    },
  });
  return new Promise((resolve, reject) => {
    const req = request(
      details.endpoint,
      { method: details.method, headers: details.headers, agent },
      (res) => {
        // Do not follow redirects or retain provider bodies (may contain credentials).
        const result = {
          status: res.statusCode ?? 500,
          retryAfter:
            typeof res.headers["retry-after"] === "string"
              ? res.headers["retry-after"]
              : undefined,
        };
        res.destroy();
        resolve(result);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Push timeout")),
      10000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end(details.body);
  });
}
