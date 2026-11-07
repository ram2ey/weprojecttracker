# Consented first-party website statistics

The user chose basic in-app analytics on 7 November 2026. Only consenting public page views are counted; no visitor identifier, IP, user agent, referrer, query, filter or user/account ID is stored in analytics. Authenticated staff sessions are excluded. Counts are approximate views, not unique people, and can be affected by reloads or spoofed/automated requests.

The public banner offers equally styled Reject analytics and Accept analytics controls. Cookie settings in the footer permits later withdrawal. The host-only, SameSite=Lax preference cookie `wassa_cookie_consent` contains a versioned accepted/rejected choice for 180 days and uses Secure over HTTPS. It is a preference record, not a visitor ID. Unknown/invalid preferences fail closed. Global Privacy Control keeps analytics off. Changes are broadcast to other open tabs, and pending browser requests are aborted on withdrawal; earlier anonymous totals cannot be attributed to a person or individually erased.

Collection uses POST `/api/public/analytics`, strict small JSON containing only a canonical public pathname, same-origin and accepted-cookie checks, a shared non-identifying rate-limit bucket, and a publication check for project pages. Browsers send no referrer with the request. GET collection is unsupported. There are no third-party scripts, widened CSP origins or tracking pixels. No requests are queued before consent, and analytics failure never blocks browsing.

The additive `analytics_daily` table stores UTC day, path and views. Records older than the rolling 90-day window are removed on the next collection/dashboard access; no background worker is introduced. Only operators see `/admin?view=analytics`, with 7/30/90-day totals, most-viewed public paths and daily counts. Staff-account permissions and independent project approvals remain unchanged.

The previous no-analytics statements in the dated public-contact implementation record describe that earlier release. The current privacy notice supersedes them. Email/contact forms remain inactive and unchanged.
