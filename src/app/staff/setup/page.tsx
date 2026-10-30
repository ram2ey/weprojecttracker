import { AuthFrame } from "@/components/staff/auth-frame";
import { SetupForm } from "@/components/staff/setup-form";
export const metadata = {
  title: "Staff account setup",
  robots: { index: false, follow: false },
};
export default function SetupPage() {
  return (
    <AuthFrame>
      <SetupForm />
    </AuthFrame>
  );
}
