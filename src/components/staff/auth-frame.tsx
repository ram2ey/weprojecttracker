import Link from "next/link";
import { ArrowLeft, Landmark, ShieldCheck } from "lucide-react";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/" className="auth-brand">
          <Landmark /> Wassa East Projects
        </Link>
        <div>
          <span className="eyebrow">THE WORK BEHIND THE PROGRESS</span>
          <p className="auth-story-title">
            Good information
            <br />
            starts with
            <br />
            <em>good stewardship.</em>
          </p>
          <p>
            A secure workspace for the people recording,
            <br />
            reviewing, and sharing our constituency&apos;s progress.
          </p>
        </div>
        <span className="auth-security">
          <ShieldCheck size={18} /> Invitation-only access · Two-factor
          authentication
        </span>
      </aside>
      <main id="main-content" className="auth-main" tabIndex={-1}>
        <Link href="/" className="text-link auth-back">
          <ArrowLeft size={16} /> Back to the public platform
        </Link>
        <div className="auth-card">{children}</div>
        <p className="auth-bottom">
          For authorised constituency staff and platform operators.
        </p>
      </main>
    </div>
  );
}
