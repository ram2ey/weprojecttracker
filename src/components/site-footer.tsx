import Link from "next/link";
import { SocialLinks } from "@/components/social-links";
import { CookieSettingsButton } from "./cookie-consent";
import { SiteBrand } from "./site-brand";
import { officeCall, officePhone, officeWhatsApp } from "@/lib/office-contact";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-identity">
          <SiteBrand />
          <p>Follow public projects across Wassa East Constituency in Ghana’s Western Region.</p>
          <SocialLinks />
        </div>
        <nav aria-label="Footer">
          <div>
          <h2>Quick links</h2>
          <Link href="/">Home</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/favourites">Favourites</Link>
          </div>
          <div>
          <h2>Information</h2>
          <Link href="/about">About the constituency</Link>
          <Link href="/faq">Frequently asked questions</Link>
          <Link href="/privacy">Privacy &amp; Cookies</Link>
          <CookieSettingsButton />
          </div>
        </nav>
        <div>
          <h2>Contact the office</h2>
          <a href={officeCall}>Call {officePhone}</a>
          <a href={officeWhatsApp}>Message on WhatsApp</a>
          <Link href="/contact">Contact details</Link>
        </div>
      </div>
    </footer>
  );
}
