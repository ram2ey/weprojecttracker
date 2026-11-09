import { z } from "zod";
export const enquiryInput = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[^\r\n]+$/),
    message: z.string().trim().min(1).max(4000),
  })
  .strict();
export function contactDelivery() {
  const key = process.env.RESEND_API_KEY,
    from = process.env.CONTACT_FROM_EMAIL,
    to = process.env.CONTACT_TO_EMAIL;
  if (
    key &&
    z.email().safeParse(from).success &&
    z.email().safeParse(to).success
  )
    return { key, from: from!, to: to! };
  return null;
}
export async function deliverEnquiry(
  input: z.infer<typeof enquiryInput>,
  mail: NonNullable<ReturnType<typeof contactDelivery>>,
  send = fetch,
) {
  const response = await send("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: "Bearer " + mail.key,
      "Content-Type": "application/json",
      "Idempotency-Key": "contact/" + input.id,
    },
    body: JSON.stringify({
      from: mail.from,
      to: [mail.to],
      reply_to: input.email,
      subject: "Wassa East enquiry: " + input.subject,
      text: input.name + " <" + input.email + ">\n\n" + input.message,
    }),
  });
  if (!response.ok || !(await response.json()).id)
    throw new Error("Delivery unavailable");
}
