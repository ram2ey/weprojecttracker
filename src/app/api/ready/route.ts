import { getPool } from "@/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getPool().query("SELECT 1");
    const release = process.env.RELEASE_ID || "local";
    let migrated = false;
    if (/^sha-[a-f0-9]{40}-\d+-\d+$/.test(release)) {
      const result = await getPool().query(
        "SELECT 1 FROM audit_log WHERE action='deployment.migrated' AND subject_id=$1 LIMIT 1",
        [release],
      );
      migrated = result.rowCount === 1;
    }
    const ready =
      migrated || (release === "local" && process.env.APP_ENV !== "production");
    return Response.json(
      { ready, release, migrated },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ready: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
