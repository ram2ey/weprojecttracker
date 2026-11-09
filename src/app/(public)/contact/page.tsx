import { officeCall, officePhone, officeWhatsApp } from "@/lib/office-contact";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata(
  "Contact Us",
  "Contact the Wassa East Constituency office about projects and general enquiries by phone or WhatsApp.",
  "/contact",
);

export default function Contact() {
  return (
    <div className="container section narrow">
      <div className="page-heading">
        <span className="eyebrow">WASSA EAST CONSTITUENCY</span>
        <h1>Contact Us</h1>
        <p>
          Get in touch with the office about a local project or a general
          constituency enquiry.
        </p>
      </div>
      <section className="detail-section">
        <h2>Speak to the office</h2>
        <p>You can call or send a message on WhatsApp.</p>
        <p>
          <a className="text-link" href={officeCall}>
            {officePhone}
          </a>
        </p>
        <div className="action-row">
          <a
            className="button button-primary"
            href={officeWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact us on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>
      <section className="detail-section">
        <h2>Your privacy</h2>
        <p>
          Share only the information the office needs to respond to your
          enquiry. Please avoid sending passwords, identity documents or other
          sensitive information.
        </p>
        <p>
          WhatsApp is an external service. Selecting the link opens WhatsApp,
          where its own privacy practices apply.
        </p>
        <Link className="text-link" href="/privacy">
          Read our Privacy &amp; Cookies information
        </Link>
      </section>
    </div>
  );
}
