import Link from "next/link";
import {
  Bell,
  MessageCircle,
  Phone,
  Settings,
  Shield,
  Info,
} from "lucide-react";
import { CookieSettingsButton } from "@/components/cookie-consent";
import { CopyrightNotice } from "@/components/site-footer";
import { officeCall, officePhone, officeWhatsApp } from "@/lib/office-contact";
import { pageMetadata } from "@/lib/site";

export const metadata = {
  ...pageMetadata(
    "More",
    "Notifications, contact details and privacy for the Wassa East app.",
    "/more",
  ),
  robots: { index: false, follow: true },
};

// The Android app's More tab. Not linked from the website menu.
export default function MorePage() {
  return (
    <div className="container section more-page">
      <h1>More</h1>
      <section aria-labelledby="more-updates">
        <h2 id="more-updates">Updates</h2>
        <ul className="more-list">
          <li>
            <Link href="/updates">
              <Bell aria-hidden="true" />
              All updates
            </Link>
          </li>
          <li>
            <Link href="/updates/settings">
              <Settings aria-hidden="true" />
              Notification settings
            </Link>
          </li>
        </ul>
      </section>
      <section aria-labelledby="more-contact">
        <h2 id="more-contact">Contact the office</h2>
        <ul className="more-list">
          <li>
            <a href={officeCall}>
              <Phone aria-hidden="true" />
              Call {officePhone}
            </a>
          </li>
          <li>
            <a href={officeWhatsApp}>
              <MessageCircle aria-hidden="true" />
              Message on WhatsApp
            </a>
          </li>
          <li>
            <Link href="/contact">
              <Info aria-hidden="true" />
              Contact details
            </Link>
          </li>
        </ul>
      </section>
      <section aria-labelledby="more-privacy">
        <h2 id="more-privacy">Privacy</h2>
        <ul className="more-list">
          <li>
            <Link href="/privacy">
              <Shield aria-hidden="true" />
              Privacy &amp; Cookies
            </Link>
          </li>
          <li>
            <CookieSettingsButton />
          </li>
        </ul>
      </section>
      <CopyrightNotice />
    </div>
  );
}
