import { getPool } from "@/db";
import { z } from "zod";
import { guestApi } from "@/lib/engagement/guest";
import { savePush } from "@/lib/engagement/push";
import { pushSchema } from "@/lib/engagement/validation";
import { jsonBody } from "@/lib/content/api";
export function GET(request: Request) {
  return guestApi(request, async (guest) => ({
    items: guest
      ? (
          await getPool().query(
            "SELECT id,enabled,updated_at FROM push_subscription WHERE device_id=$1",
            [guest.id],
          )
        ).rows
      : [],
  }));
}
export function POST(request: Request) {
  return guestApi(
    request,
    async (guest) =>
      savePush(guest!, pushSchema.parse(await jsonBody(request))),
    { create: true, required: true },
  );
}
export function DELETE(request: Request) {
  return guestApi(
    request,
    async (guest) => {
      z.object({ all: z.literal(true) })
        .strict()
        .parse(await jsonBody(request));
      await getPool().query(
        "DELETE FROM push_subscription WHERE device_id=$1",
        [guest!.id],
      );
      return { unsubscribed: true };
    },
    { required: true },
  );
}
