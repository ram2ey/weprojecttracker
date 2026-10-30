import { guestApi } from "@/lib/engagement/guest";
import { submitGuest } from "@/lib/engagement/service";
import { submissionSchema } from "@/lib/engagement/validation";
import { jsonBody } from "@/lib/content/api";
import { getIdentity } from "@/lib/security/staff-session";
export function POST(request: Request) {
  return guestApi(
    request,
    async (guest) => {
      const input = submissionSchema.parse(await jsonBody(request));
      const identity = await getIdentity(request.headers);
      return submitGuest(request, guest!, input, identity?.user.id ?? null);
    },
    { required: true },
  );
}
