import { isIP } from "node:net";

// Abuse-control bucket for a request. The value is only ever used as an
// HMAC-hashed rate-limit key; it is never stored or logged in readable form.
//
// The front proxy (Traefik, or the Cloudflare edge) replaces or appends to
// X-Forwarded-For, and Next only fills it when absent. A single entry is the
// proxy's view of the client; a list means the caller supplied its own value,
// so it is not trusted and falls into the shared "unknown" bucket.
export function clientAddress(headers: Headers): string | null {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length !== 1) return null;
  let address = entries[0].toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) address = mapped[1];
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6) return null;
  // One IPv6 subscriber usually controls a whole /64, so group by that prefix.
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = address.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  return (
    groups
      .slice(0, 4)
      .map((group) => group.replace(/^0+(?=.)/, ""))
      .join(":") + "::/64"
  );
}

export function addressBucket(headers: Headers) {
  const address = clientAddress(headers);
  return address
    ? { key: "address:" + address, known: true }
    : { key: "address:unknown", known: false };
}
