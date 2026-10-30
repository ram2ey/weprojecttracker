import { AuthFrame } from "@/components/staff/auth-frame";
import { LoginForm } from "@/components/staff/login-form";
import { authConfigured } from "@/lib/env";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff sign-in",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <AuthFrame>
      <LoginForm
        configured={authConfigured()}
        googleEnabled={Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )}
      />
    </AuthFrame>
  );
}
