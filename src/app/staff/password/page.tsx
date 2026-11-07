import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/security/staff-session";
import { AuthFrame } from "@/components/staff/auth-frame";
import { PasswordForm } from "@/components/staff/password-form";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
};
export default async function PasswordPage() {
  const identity = await getIdentity(await headers());
  if (!identity) redirect("/staff/login");
  return (
    <AuthFrame>
      <PasswordForm required={identity.staff.mustChangePassword} />
    </AuthFrame>
  );
}
