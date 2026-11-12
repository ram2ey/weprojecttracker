import Link from "next/link";
import { contactDelivery } from "@/lib/contact-delivery";
import { pageMetadata } from "@/lib/site";
import { backupStatus } from "@/lib/backup-status";

export const metadata = pageMetadata(
  "Privacy & Cookies",
  "How the Wassa East project website handles information, essential cookies and external contact services.",
  "/privacy",
);

export default async function Privacy() {
  // Describe off-site copies only once a nightly backup has really completed.
  const backupsActive =
    (await backupStatus().catch(() => "none" as const)) !== "none";
  return (
    <div className="container section narrow">
      <h1>Privacy &amp; Cookies</h1>
      <p className="subtle-note">Last updated: 12 November 2026</p>
      <section className="detail-section">
        <h2>Favourites and phone layout</h2>
        <p>
          When you save a project or choose a phone layout, this browser
          remembers your selection on this device. Clearing site data removes
          your favourites and layout preference.
        </p>
      </section>
      <section className="detail-section">
        <h2>Updates and optional notifications</h2>
        <p>
          Anyone can read the Updates page without turning anything on. This
          browser remembers on this device which updates you have read and
          whether you closed the notification invitation; nothing about that is
          sent to us.
        </p>
        <p>
          If you turn on notifications, your browser asks for permission first.
          An essential cookie then identifies this browser installation. The
          server stores a hash of its random token, the topics you receive
          (all categories and news unless you untick some), delivery records
          and encrypted browser subscription details. Approved updates are sent
          through your browser provider’s push service, which processes delivery
          information under its own terms. No public account or cross-device
          tracking is required, and subscription details are not used for
          analytics or advertising. These settings expire after 180 days;
          update history is retained for up to 90 days and removed during
          scheduled cleanup.
        </p>
        <p>
          You can turn notifications off in Notification settings or block them
          in your browser settings. Clearing site data removes this browser’s
          access to its saved settings, but does not immediately delete server
          records; those expire as described above. Delete notification data in
          Notification settings removes the device’s topics, delivery records
          and push subscription from the service and this browser’s read
          history. Private recovery copies may retain previous records until
          those copies expire.
        </p>
      </section>
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
          trackers or embedded social widgets. It does not save a separate
          history of phone or WhatsApp enquiries in its database.
        </p>
      </section>
      <section className="detail-section">
        <h2>Public project and news comments</h2>
        <p>
          When you post a comment on a project or news story, your chosen name,
          message and posting date appear publicly immediately. Names are not
          verified. Do not include private contact details or sensitive
          information. No public account, email address or phone number is
          required.
        </p>
        <p>
          Posting a comment creates the essential wassa_comment_guard cookie for
          up to 24 hours. This signed, HttpOnly cookie supports posting limits
          and safe retries. It works independently of optional website
          statistics. Posting limits also count requests per network address;
          the address is stored only as a one-way hash inside a short-lived
          counter. Rate-limit keys and submission keys are hashed; comment
          records do not store your IP address. Hosting security logs may still
          contain IP addresses.
        </p>
        <p>
          The platform operator can close new comments and hide or restore
          comments. Hidden names and messages remain private and recoverable;
          hiding is not deletion. Comments have no automatic expiry in this
          version. To request removal or raise a concern, contact the office.
          Without verified visitor accounts, the office cannot automatically
          verify authorship. Public and hidden comments may be included in
          private recovery copies.
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
          Analytics stays off until you select Accept or enable it in Cookie
          settings. Rejecting has no effect on access to the website or staff
          authentication. You can change your choice using Cookie settings in
          the footer at any time. We also respect your browser’s Global Privacy
          Control signal.
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
        {backupsActive ? (
          <p>
            Private database and file copies are kept for recovery. Each night
            the website makes an encrypted copy, which is stored with Backblaze,
            a cloud storage provider. The encryption happens before upload, so
            Backblaze cannot read the copies. Copies are kept for up to six
            months (daily for two weeks, then weekly and monthly) and then
            deleted automatically. They can contain staff account data, private
            project history and public comments, including hidden ones, and are
            not publicly available.
          </p>
        ) : (
          <p>
            Private database and file copies may be retained for recovery. A
            one-time release safety copy exists; ongoing scheduled backups are
            not currently active. Copies can contain staff account data and
            private project history and are not publicly available.
          </p>
        )}
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
          {contactDelivery()
            ? "When you use the enquiry form, Resend processes your name, email, subject and message for delivery to the office. The website keeps no separate copy of the message. Hashed rate-limit keys, including a one-way hash of your network address, help prevent abuse."
            : "Website email enquiries are not currently enabled."}{" "}
          The office plans to delete email enquiries 90 days after closure as a
          mailbox-handling policy; this is not automated by the website.
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
