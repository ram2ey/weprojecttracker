# Public navigation and contact update

Approved 7 November 2026. Public navigation includes Projects, About and Contact Us, with Privacy & Cookies in the footer. Staff bookmark `/staff/login`; removing public links does not replace authentication or make that address secret. Phone navigation at 800px and below uses a sticky header and accessible disclosure menu. The hero heading is Project Tracker.

The office supplied `+233241152479` as its contact number and the location Daboase - Atteiku Road, after Health Insurance Office. Its digital address is `WR-003-77-98`. Contact links open the phone handler or WhatsApp.

The contact form stays in preview until the server has a Resend API key, a verified sender email address and an office destination. Set `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL` in the deployment environment. The intended destination is `support@wassaeastprojecttracker.com`. Verify mailbox access and test receipt on staging before enabling production. The form delivers the resident’s name, reply email, subject and message as plain text. The website stores no message history. Provider acceptance is reported separately from inbox delivery. The office’s intended mailbox retention period is 90 days after enquiry closure.

The privacy page describes current public browsing, private staff authentication/session data, security/operational records, private recovery copies and external contact handling. It introduces no acceptance banner or tracking cookies. Reassess consent and update the notice before adding optional tracking or collecting form submissions. The notice is grounded in the actual implementation and Ghana Data Protection Commission guidance: https://dpc.gov.gh/for-individuals/.

Android packaging remains deferred. A future web wrapper reuses the responsive header but still needs real-device navigation, accessibility and external phone/WhatsApp checks.
