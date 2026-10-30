import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteBrand } from "../site-brand";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <main id="main-content" className="auth-main" tabIndex={-1}>
        <SiteBrand className="auth-brand" />
        <Link href="/" className="text-link auth-back">
          <ArrowLeft size={16} /> Back to website
        </Link>
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
