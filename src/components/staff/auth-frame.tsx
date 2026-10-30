import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <main id="main-content" className="auth-main" tabIndex={-1}>
        <Link href="/" className="auth-brand">
          <Landmark size={22} /> Wassa East Projects
        </Link>
        <Link href="/" className="text-link auth-back">
          <ArrowLeft size={16} /> Back to website
        </Link>
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
