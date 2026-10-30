import { pushConfigured } from "@/lib/engagement/push";
export const dynamic = "force-dynamic";
export function GET() {
  const configured = pushConfigured();
  return Response.json(
    {
      enabled: configured,
      publicKey: configured ? process.env.VAPID_PUBLIC_KEY : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
