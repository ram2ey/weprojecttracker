import { appUrl } from "@/lib/env";
export function checkOrigin(request: Request) {
  return request.headers.get("origin") === new URL(appUrl()).origin;
}
export function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
// Authentication forms have small, fixed fields. Bound streamed bodies as well
// as declared lengths before parsing; an absent Content-Length grants no bypass.
export async function smallJson(
  request: Request,
  maximum = 16 * 1024,
): Promise<unknown | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    if (Number(request.headers.get("content-length")) > maximum) {
      await reader.cancel();
      return null;
    }
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
