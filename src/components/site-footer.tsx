import Link from "next/link";
import { CookieSettingsButton } from "./cookie-consent";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>Wassa East Constituency · Western Region, Ghana</p>
        <nav aria-label="Footer">
          <Link href="/">Projects</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact Us</Link>
          <Link href="/privacy">Privacy &amp; Cookies</Link>
          <CookieSettingsButton />
        </nav>
      </div>
    </footer>
  );
}
