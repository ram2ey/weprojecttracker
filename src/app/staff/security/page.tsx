import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/staff/auth-frame";
import { SecurityForm } from "@/components/staff/security-form";
import { getIdentity } from "@/lib/security/staff-session";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Verify your identity",
  robots: { index: false, follow: false },
};
export default async function SecurityPage() {
  const identity = await getIdentity(await headers());
  if (!identity) redirect("/staff/login");
  if (identity.verified) redirect("/admin");
  return (
    <AuthFrame>
      <SecurityForm enrolled={identity.staff.mfaEnabled} />
    </AuthFrame>
  );
}
