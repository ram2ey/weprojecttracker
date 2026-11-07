# Simple project comments

Visitors can post a name (1–80 characters) and plain-text message (1–2,000 characters) on a published project without an account. Comments appear immediately, newest first, in pages of 20. Names are unverified. There are no replies, uploads, automatic links, notifications or email dependencies. Removal requests use the existing office contact options.

The additive `project_comment` table is separate from retired guest submissions, which remain inaccessible. It stores a project reference, name/message, timestamp, hashed submission key and moderation metadata. A repeated submission identifier from the same browser returns the previous result; a changed payload using that identifier is rejected. Hidden comments remain private and recoverable with no automatic expiry.

Public endpoints:

- GET `/api/public/content/[slug]/comments?page=1`: currently visible comments and the project's commenting state. No guest identifier is returned or set.
- POST `/api/public/content/[slug]/comments/session`: same-origin form activation. Sets `wassa_comment_guard` only when needed: signed, HttpOnly, SameSite=Strict, Secure over HTTPS, 24-hour expiry.
- POST `/api/public/content/[slug]/comments`: strict bounded JSON `{submissionId, displayName, body, website}`. `website` is the empty honeypot. Requires the signed cookie and same origin, but no optional statistics permission.

Posting limits allow three attempts per browser per ten minutes and 60 site-wide per minute; exact successful retries do not spend another attempt. Only HMAC keys enter rate-limit storage. No comment IP addresses are recorded. Expired counters are pruned during submissions. Basic limits do not eliminate spam or impersonation. Publication and posting are checked under the project's row lock, so closing and withdrawal serialize with submissions. Closed discussions retain visible comments; withdrawn or unpublished projects return 404.

Only verified, active operators can access `/admin?view=comments` and GET/PATCH `/api/staff/comments`. The screen filters by project and visible/hidden state. Operators can hide/restore comments and change the existing project commenting flag. Version checks reject stale moderation actions. Audit records contain action/actor/subject IDs, never comment names or messages. Hiding is reversible and is not deletion. No retired guest APIs, worker or public accounts are reactivated.

Tests cover plain-text rendering, failed-response retries, pagination failures, role restrictions, reversible moderation, version conflicts, rate limits, forged cookies, origin and request bounds, retired-data isolation, closure/withdrawal races, analytics denial, accessibility and phone layouts. Migration rehearsal preserves legacy credentials, projects, media and retired comments while creating an empty new table. The protected release pipeline performs the production build, container validation and exact-release live smoke checks. Do not publish fixture projects on production for verification.
