import Link from "next/link";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata(
  "Privacy & Cookies",
  "How the Wassa East project website handles information, essential cookies and external contact services.",
  "/privacy",
);

export default function Privacy() {
  return (
    <div className="container section narrow">
      <h1>Privacy &amp; Cookies</h1>
      <p className="subtle-note">Last updated: 7 November 2026</p>
      <section className="detail-section">
        <h2>Who manages this website</h2>
        <p>
          This project information website is managed by the Office of the
          Member of Parliament for Wassa East Constituency, under the public
          name Wassa East Constituency. The office is responsible for how
          information is handled through this service.
        </p>
      </section>
      <section className="detail-section">
        <h2>Browsing project information</h2>
        <p>
          You can browse published projects without creating an account.
          Published project records may include photographs, information sources
          and approved updates. Please contact the office if you have a question
          about information or a photograph published here.
        </p>
        <p>
          With your permission, the website counts public page views using its
          own server. It does not use third-party analytics, advertising
          trackers, embedded social widgets, or a public enquiry form. It does
          not save a separate history of phone or WhatsApp enquiries in its
          database.
        </p>
      </section>
      <section className="detail-section">
        <h2>Essential cookies and staff access</h2>
        <p>
          Authorised staff use essential authentication cookies to sign in and
          maintain the register. These cookies support secure sessions; they are
          not used for advertising. Staff account information, password hashes,
          session details such as IP address and browser information, and
          records of staff actions are stored to manage access and protect the
          service.
        </p>
        <p>
          Staff can end their session by signing out. Blocking authentication
          cookies can prevent sign-in from working. A separate first-party
          cookie, wassa_cookie_consent, remembers whether you accept or reject
          optional analytics for 180 days. This preference cookie contains only
          your choice and is needed to remember it; it is not a visitor
          identifier.
        </p>
      </section>
      <section className="detail-section">
        <h2>Optional page-view statistics</h2>
        <p>
          Analytics stays off until you select Accept or enable it in
          Cookie settings. Rejecting has no effect on access to the website or
          staff authentication. You can change your choice using Cookie settings
          in the footer at any time. We also respect your browser’s Global
          Privacy Control signal.
        </p>
        <p>
          We store only a daily date, a public page path and a count. Analytics
          does not store visitor IDs, IP addresses, browser details, referrers,
          search text or filter choices, and authenticated staff sessions are
          excluded. Statistics show page views and popular pages, not unique
          visitors. Only platform operators can view the statistics.
        </p>
        <p>
          Daily statistics cover up to 90 days. Expired aggregates are removed
          on the next collection or operator dashboard visit. Withdrawing
          permission stops future counting. Previously collected totals are
          anonymous and cannot be linked back to you. No analytics data is sent
          to an external analytics provider.
        </p>
      </section>
      <section className="detail-section">
        <h2>Technical records and security</h2>
        <p>
          Hosting and security systems may record technical information,
          including IP addresses, request details and errors, to operate the
          website, investigate faults and prevent misuse. Access to private
          records is restricted to authorised personnel and the service
          providers needed to run the website.
        </p>
        <p>
          Private database and file copies may be retained for recovery. A
          one-time release safety copy exists; ongoing scheduled backups are not
          currently active. Copies can contain staff account data and private
          project history and are not publicly available.
        </p>
        <p>
          Information is kept for operational, security and recovery needs and
          reviewed when no longer needed. This website does not currently
          enforce automatic expiry for all operational records or recovery
          copies.
        </p>
      </section>
      <section className="detail-section">
        <h2>Contacting the office and WhatsApp</h2>
        <p>
          When you call or use WhatsApp, the office receives the contact
          information and message you choose to share so it can respond. The
          WhatsApp link opens an external service; WhatsApp processes
          information under its own privacy terms. No WhatsApp widget is loaded
          on this website.
        </p>
        <p>
          Website email enquiries are not currently enabled. If introduced, we
          will explain the information collected and delivery service before
          accepting submissions. The office plans to delete future email
          enquiries 90 days after closure as a mailbox-handling policy; this is
          not automated by the website.
        </p>
      </section>
      <section className="detail-section">
        <h2>Questions and requests</h2>
        <p>
          Contact the office to ask about your information, request access or
          correction, or raise a privacy concern. The office will consider
          deletion requests alongside any information it needs to retain for
          legitimate duties.
        </p>
        <Link className="text-link" href="/contact">
          Contact the office
        </Link>
      </section>
    </div>
  );
}
