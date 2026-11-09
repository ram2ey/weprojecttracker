import { officeCall, officePhone, officeWhatsApp } from "@/lib/office-contact";
import Link from "next/link";
import Image from "next/image";
import { SocialLinks } from "@/components/social-links";
import { FaqSection } from "@/components/faq-section";
import { pageMetadata } from "@/lib/site";
import { contactDelivery } from "@/lib/contact-delivery";
import { ContactForm } from "@/components/contact-form";

export const metadata = pageMetadata(
  "Contact Us",
  "Contact the Wassa East Constituency office about projects and general enquiries by phone or WhatsApp.",
  "/contact",
);

export default function Contact() {
  return (
    <>
      <div className="container section contact-page">
        <div className="page-heading">
          <span className="eyebrow">WASSA EAST CONSTITUENCY</span>
          <h1>Contact Us</h1>
          <p>
            Get in touch with the office about a local project or a general
            constituency enquiry.
          </p>
        </div>
        <div className="contact-columns">
          <section className="office-panel">
            <h2>Wassa East Constituency Office</h2>
            <address className="office-address">
              <p>Daboase - Atteiku Road<br />After Health Insurance Office</p>
              <p>Digital address<br /><strong>WR-003-77-98</strong></p>
            </address>
            <p>You can call or send a message on WhatsApp.</p>
            <p>
              <a className="text-link" href={officeCall}>
                Call us: {officePhone}
              </a>
            </p>
            <div className="action-row">
              <a
                className="button button-primary"
                href={officeWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image src="/brand/whatsapp.svg" alt="" width={20} height={20} className="whatsapp-icon" />
                Contact us on WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            <SocialLinks />
            <p className="subtle-note">
              WhatsApp is an external service. Selecting the link opens
              WhatsApp, where its own privacy practices apply.
            </p>
          </section>
          <section className="enquiry-panel" aria-labelledby="enquiry-title">
            <h2 id="enquiry-title">Send a message</h2>
            {contactDelivery() ? (
              <ContactForm />
            ) : (
              <>
                <p id="enquiry-note">
                  Form preview only. To reach the office, call or use WhatsApp.
                </p>
                <fieldset
                  aria-label="Enquiry preview"
                  aria-describedby="enquiry-note"
                >
                  <div className="enquiry-pair">
                    <label>
                      Name
                      <input autoComplete="name" />
                    </label>
                    <label>
                      Email
                      <input type="email" autoComplete="email" />
                    </label>
                  </div>
                  <label>
                    Subject
                    <input />
                  </label>
                  <label>
                    Message
                    <textarea rows={4} />
                  </label>
                  <p className="subtle-note">
                    Please leave out passwords, identity documents and sensitive
                    personal information.{" "}
                    <Link href="/privacy">Privacy &amp; Cookies</Link>
                  </p>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled
                  >
                    Send message
                  </button>
                </fieldset>
              </>
            )}
          </section>
        </div>
      </div>
      <FaqSection topic="contact" />
    </>
  );
}
