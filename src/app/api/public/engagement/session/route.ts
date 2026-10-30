import { guestApi, challenge } from "@/lib/engagement/guest";
export function GET(request: Request) {
  return guestApi(request, async (guest) => challenge(guest!), {
    create: true,
  });
}
