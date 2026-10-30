import { z } from "zod";
import { guestApi } from "@/lib/engagement/guest";
import { discussion } from "@/lib/engagement/service";
export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await context.params;
  return guestApi(request, async (guest) => {
    z.uuid().parse(recordId);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("page") ?? 1);
    return discussion(recordId, guest, page);
  });
}
