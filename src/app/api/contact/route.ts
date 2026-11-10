import {
  contactDelivery,
  deliverEnquiry,
  enquiryInput,
} from "@/lib/contact-delivery";
import { checkOrigin, privateJson, smallJson } from "@/lib/security/http";
import { consumeLimit } from "@/lib/security/rate-limit";
import { addressBucket } from "@/lib/security/client-address";

export async function POST(request: Request) {
  if (!checkOrigin(request))
    return privateJson({ message: "Invalid request origin." }, 403);
  const mail = contactDelivery();
  if (!mail)
    return privateJson(
      {
        message:
          "Email enquiries are unavailable. Please call or use WhatsApp.",
      },
      503,
    );
  const parsed = enquiryInput.safeParse(await smallJson(request, 24 * 1024));
  if (!parsed.success)
    return privateJson(
      { message: "Check your name, email, subject and message." },
      400,
    );
  try {
    const address = addressBucket(request.headers);
    if (
      // Checked first so one sender cannot use up the shared hourly allowance.
      !(await consumeLimit(
        "contact:" + address.key,
        address.known ? 5 : 30,
        3600,
      )) ||
      !(await consumeLimit("contact:hour", 90, 3600)) ||
      !(await consumeLimit(
        "contact:email:" + parsed.data.email.toLowerCase(),
        4,
        900,
      ))
    )
      return privateJson(
        {
          message:
            "Too many enquiries. Try again later or contact the office by phone.",
        },
        429,
      );
    await deliverEnquiry(parsed.data, mail);
    return privateJson({ accepted: true });
  } catch {
    return privateJson(
      {
        message:
          "We could not confirm submission. Retry, call or use WhatsApp.",
      },
      503,
    );
  }
}
