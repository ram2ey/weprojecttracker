# Phase 0 decision record — Wassa East project register

Updated **6 November 2026**. Status: **product/technical decisions and email provider confirmed; mailbox setup and Play registration/verification preparation in progress**. This record separates confirmed answers from unresolved operational tasks.

## Confirmed by the user

| Item | Decision/context |
| --- | --- |
| Intended constituency | Wassa East Constituency |
| Development context | The user works in the IT department under the MP; the app is for Wassa East Constituency. |
| Android scope | Public browsing of projects. Staff use the website for administration. |
| Play Console account | No account exists yet for this publisher. |
| Publisher name | Office of the Member of Parliament for Wassa East Constituency — confirmed by the user. |
| Office authorization | The user confirms office approval for public release under that name and use of the constituency logo. |
| Public app title | Wassa East Projects |
| Purchased domain | wassaeastprojecttracker.com — registration and DNS inspected in Nakroteck. |
| Email | Zoho support mailbox created; routing/authentication validation and send/receive checks remain pending. Nakroteck provides domain/DNS only. |
| Domain/DNS provider | Nakroteck.net, using ns1/ns2/ns3.dnsowl.com; DNS management inspected. |
| Administrative responsibility | The user will administer the office-owned Play Console account, domain renewals and support email on behalf of the office. |
| Launch availability | Worldwide |
| Launch language | English first |
| Intended audience | Adults aged 18 and over; this is the intended design audience, not a decision to add an age gate. |
| Project editors | Project Personnel prepare project records. |
| Independent approver | Project Lead approves publication. Anyone who contributes to a revision must have a separate person approve it. |
| Canonical website | https://wassaeastprojecttracker.com, with `www` redirected to it. Approved; not yet configured. |
| Public support address | support@wassaeastprojecttracker.com — created in Zoho and listed as the organization's super-administrator email. Existing signed-in Zoho account retained; no new password entered by the assistant. |
| Android architecture | Trusted Web Activity around the hosted public register; staff administration opens in the browser. Approved; not yet built. |
| Android package identifier | com.wassaeastprojecttracker.app. Approved; not yet registered or built. |
| Email provider/plan | User chose to remain on Zoho Mail Free for now on 6 November 2026, superseding the earlier Mail Lite choice. Dashboard confirms Mail Free (5 licenses). No paid subscription purchased; Mail Lite is an optional future upgrade. |
| Zoho signup/setup | User completed signup and signed in. Domain ownership verified successfully and support mailbox created on 6 November 2026. MX/SPF/DKIM are saved in Nakroteck; public DNS validation and delivery checks remain pending. |
| Zoho organization label | Office of the MP for Wassa East Constituency — abbreviated only for Zoho's 50-character field limit; the confirmed publisher wording above is unchanged. |
| Zoho checkout observation | One Mail Lite 5GB user, annual billing, no add-ons: $8.40 subtotal/total before billing details and any applicable tax, observed and reconfirmed 6 November 2026. Payment form prepared for the user; no payment submitted by the assistant. |
| Domain DNS observation | Initial NXDOMAIN was observed before registration completed. After registration and TXT publication, ns1.dnsowl.com returned the exact Zoho verification TXT record; Zoho then confirmed domain ownership. |
| Nakroteck registration status | User completed the registrant details and retried registration. Nakroteck now reports Active, registered 6 November 2026 through 6 November 2027, with auto-renew enabled. Nameservers: ns1.dnsowl.com, ns2.dnsowl.com, ns3.dnsowl.com. |
| DNS inspection | Existing root/www A records are registrar defaults; website records have not been changed. Approved ownership TXT verified by Zoho. Three MX records, SPF and Zoho-provided DKIM saved successfully in Nakroteck (TTL 3600). Initial authoritative queries still showed the previous zone; Zoho reported propagation pending. |

Publisher wording and office approval are confirmed by the user. The Google registration classification, supporting identity documents and any requested authorization documentation remain to be established. No claim of Google government-agency verification has been made.

## Remaining setup decisions

- Verify propagation of the saved MX/SPF/DKIM records and test mailbox delivery on Mail Free. The paid Mail Lite upgrade is deferred by the user; payment is not a remaining launch prerequisite for this mailbox choice.
- Establish the office-managed account ownership/recovery arrangement with individual technical access. Determine the correct Play registration classification and evidence before registering.
- Domain connection, mailbox creation and Android packaging are implementation tasks; approval of their identity/settings does not mean they already exist.

The support mailbox exists on Mail Free, but DNS validation and delivery checks are still pending. Play registration/verification, website-domain connection and supporting documentation also remain operational tasks; confirmed product answers alone do not mark those tasks complete.

## Open decisions

- [x] Confirm the publisher name and office approval for release and constituency branding.
- [x] Confirm the public app title.
- [x] Identify the purchased domain.
- [x] Confirm DNS provider and administrative responsibility.
- [x] Confirm the public support address.
- [x] Select Zoho as the official email service; retain Mail Free for now (paid upgrade deferred).
- [ ] Finish office-mail setup: domain verified and support mailbox created; validate MX/SPF/DKIM propagation and send/receive delivery.
- [x] Select the permanent public origin and durable Android package identifier.
- [x] Confirm TWA architecture and external-browser staff administration.
- [x] Identify who will administer the office-owned Play account.
- [ ] Establish the account's registration classification, formal owner/recovery arrangement and verification route; create/verify it when ready.
- [x] Assign domain/platform administration and support-email responsibility to the user; editorial preparation to Project Personnel; independent publication approval to Project Lead.
- [ ] Confirm incident/backup operating ownership during infrastructure preparation.
- [x] Confirm launch countries and initial language.
- [x] Confirm intended target audience/age groups.
- [ ] Record branding/photo rights and the source/affiliation wording appropriate to the actual publisher.

## Registration guidance

Use Google's [account-type requirements](https://support.google.com/googleplay/android-developer/answer/13634885) to determine the correct account. Government apps have organization-account requirements; an MP-office relationship must be classified accurately rather than assumed to be a verified government agency. Eligible government organizations without a D-U-N-S number can contact Google for verification assistance.

Google's [government-information guidance](https://support.google.com/googleplay/android-developer/answer/9514050) calls for truthful affiliation and clear sources, and encourages official government email/authorization documentation where applicable. Obtain the actual identity details before creating the account or writing an official-government claim.

Zoho signup was completed by the user. Zoho domain ownership is now verified using the approved TXT record; support-address setup is in progress. No Play developer account has been created and no payment has been submitted by the assistant during this setup session.

## Email comparison — 6 November 2026

Prices below are advertised USD prices for the stated plan, before applicable tax and regional checkout differences. They are not guaranteed future renewal prices. No purchase was made.

| Provider | Advertised cost | Fit/qualification |
| --- | --- | --- |
| [Zoho Mail Lite](https://www.zoho.com/mail/compare/overview.html) | Entry paid price $1/user/month billed annually: $12/year for one user | Recommended starting point for the office; custom-domain mail, administrative features and paid-plan mail-client access. Confirm current regional plan/checkout price. |
| [Namecheap Private Email Launch](https://www.namecheap.com/hosting/email/) | $14.88/year regular/renewal price; introductory discounts/trial may apply | One 5GB mailbox, with 10 aliases according to its [plan comparison](https://www.namecheap.com/support/knowledgebase/article.aspx/10789/2179/private-email-plans-comparison/). |
| [Purelymail Simple](https://purelymail.com/pricing) | $10/year | Low advertised cost; significant resource use may require advanced usage-based pricing. |

Initial scope: one office-managed support mailbox on Zoho Mail Free, with individual authorized administration, strong account protection and office-controlled recovery. The user deferred the earlier paid-mailbox proposal. Additional mailbox/alias needs can be decided without assuming every project editor needs a paid email seat. Mail hosting can be configured through DNS without moving the domain registration from Nakroteck.

## Play registration inquiry draft — not sent

**Subject:** Appropriate organization verification route for Wassa East MP office app

We are the IT team working under the Member of Parliament for Wassa East Constituency, Ghana. We are preparing a public project-information app, Wassa East Projects, for publication under the name Office of the Member of Parliament for Wassa East Constituency. The office has approved the app's public release and constituency branding.

Before creating the Play Console developer account, please confirm the appropriate organization verification route for this office. Please advise which Ghana-specific organization/authorization documents are accepted and whether alternative verification is available if this office does not have a D-U-N-S number. We can arrange appropriate office authorization evidence and confirm domain/email ownership through the authorized representative.

The app will provide public browsing with no public accounts; staff administration remains on the website. Our controlled domain is wassaeastprojecttracker.com. We have not yet created a Play developer account.

This draft asks for classification guidance; it does not assert that Google has verified the office as a government agency. The D-U-N-S position itself still needs confirmation with the office. Contacting Google is a later explicit action, not part of recording these decisions.
