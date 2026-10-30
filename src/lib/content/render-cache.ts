import { getPool } from "@/db";
type Entry = {
  bytes: Uint8Array;
  headers: [string, string][];
  expires: number;
};
const entries = new Map<string, Entry>(),
  pending = new Map<string, Promise<Entry | null>>();
let storedBytes = 0;
const maxBytes = 16 * 1024 * 1024,
  maxEntries = 64,
  maxEntryBytes = 1_500_000;
// This signature is read on every request. No time-based data cache or
// cross-process invalidation is required: every web process sees DB commits.
export async function publicRenderVersion() {
  const result = await getPool().query<{ version: string }>(`SELECT
 md5(coalesce((SELECT jsonb_agg(jsonb_build_array(r.id,r.kind,r.slug,r.version,r.published_revision_id,r.withdrawn_at,v.state,v.updated_at) ORDER BY r.id)::text FROM content_record r LEFT JOIN content_revision v ON v.id=r.published_revision_id),'[]'))||':'||
 md5(coalesce((SELECT jsonb_agg(jsonb_build_array(id,kind,name,parent_id,active) ORDER BY id)::text FROM taxonomy),'[]'))||':'||
 md5(coalesce((SELECT jsonb_agg(jsonb_build_array(id,record_id,internal_only,withdrawn_at) ORDER BY id)::text FROM media_file),'[]')) AS version`);
  return result.rows[0].version;
}
function forget(key: string) {
  const old = entries.get(key);
  if (old) {
    storedBytes -= old.bytes.byteLength;
    entries.delete(key);
  }
}
function put(key: string, value: Entry) {
  forget(key);
  entries.set(key, value);
  storedBytes += value.bytes.byteLength;
  while (entries.size > maxEntries || storedBytes > maxBytes) {
    const first = entries.keys().next().value;
    if (!first) break;
    forget(first);
  }
}
export async function publicRender(
  key: string,
  render: () => Promise<Response>,
) {
  const old = entries.get(key);
  if (old && old.expires > Date.now()) {
    forget(key);
    put(key, old);
    return { entry: old, hit: true };
  }
  if (old) forget(key);
  const inFlight = pending.get(key);
  if (inFlight) return { entry: await inFlight, hit: true };
  if (pending.size >= 16) return { entry: null, hit: false };
  const work = (async () => {
    const response = await render();
    if (
      response.status !== 200 ||
      response.headers.has("set-cookie") ||
      response.headers.get("X-Public-Cache") !== "public-page-v1" ||
      !response.headers.get("Content-Type")?.includes("text/html")
    )
      return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxEntryBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const headers = new Headers(response.headers);
    for (const name of [
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection",
      "keep-alive",
    ])
      headers.delete(name);
    const value = {
      bytes,
      headers: [...headers.entries()],
      expires: Date.now() + 300000,
    };
    put(key, value);
    return value;
  })();
  pending.set(key, work);
  try {
    return { entry: await work, hit: false };
  } finally {
    pending.delete(key);
  }
}
