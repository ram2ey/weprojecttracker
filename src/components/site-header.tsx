import Link from "next/link";
import { SiteBrand } from "./site-brand";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <SiteBrand />
        <nav aria-label="Main navigation">
          <Link href="/">Projects</Link>
          <Link href="/about">About</Link>
          <Link href="/staff/login">Staff sign-in</Link>
        </nav>
      </div>
    </header>
  );
}
