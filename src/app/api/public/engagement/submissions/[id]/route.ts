import { z } from "zod";
import { guestApi } from "@/lib/engagement/guest";
import { withdrawOwn } from "@/lib/engagement/service";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return guestApi(
    request,
    async (guest) => {
      z.uuid().parse(id);
      return withdrawOwn(guest!, id);
    },
    { required: true },
  );
}
