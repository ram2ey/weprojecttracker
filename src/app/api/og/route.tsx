import { ImageResponse } from "next/og";
import { getPublicContent } from "@/lib/content/public";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug && slug.length > 160) return new Response(null, { status: 404 });
  const record = slug ? await getPublicContent(slug) : null;
  if (slug && !record)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f6f5ed",
        padding: "68px 76px",
        color: "#173f31",
        borderTop: "12px solid #b43d35",
      }}
    >
      <div style={{ display: "flex", fontSize: 25, letterSpacing: 3 }}>
        WASSA EAST · PROJECT TRACKER
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          fontSize: record ? 56 : 78,
          lineHeight: 1.12,
          maxWidth: 1000,
        }}
      >
        {record
          ? record.payload.title.slice(0, 140)
          : "Our communities. Our progress."}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 23,
          borderTop: "1px solid #bdccbc",
          paddingTop: 24,
        }}
      >
        <span>
          {record?.kind === "project"
            ? `${record.payload.communityName} · ${record.payload.status} · ${record.payload.progress}%`
            : record?.kind === "report"
              ? "Approved public report"
              : record?.kind === "announcement"
                ? "Constituency announcement"
                : "Open information. Shared progress."}
        </span>
        <span>{record?.code ?? "Western Region, Ghana"}</span>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
