# Wassa East minimal production release

Agreed scope: 5 November 2026. This replaces the earlier five-phase launch scope; prior verification documents remain historical records.

## Product decisions

- Public project register at /, project details, About; no visitor accounts.
- Up to 200 projects and roughly 2–5 staff; manual entry, no import.
- Existing branding, self-hosted Creato Display typography with system fallbacks, neutral cards and light mode only.
- Search by title/code/community; category/community/status filters and pagination.
- Essential project fields and photographs only. All six statuses remain.
- Completed projects require a completion date, summary and photograph.
- Editors submit drafts; an independent approver publishes or returns them. Preserve old publications during review and private history afterward.
- Individual usernames/passwords; operator account creation/reset/deactivation/session revocation; first-login password change. No Google login or MFA.
- Five fixed categories; editable/retirable communities.
- Remove engagement, following, inboxes, reminders, push, offline/PWA, maps, announcements, reports/exports, themes and decorative motion.
- Preserve existing data, password hashes, historical media and Git history. Retire old offline caches safely. Remove the worker and custom full-register render cache.

## Delivery checklist

- [x] Reduced public and staff screens and strict project contracts implemented.
- [x] Additive username/password-change migration and maintenance commands implemented.
- [x] Retired feature routes, application code and dependencies removed; legacy tables retained.
- [x] Production configuration and documentation updated for web/database/migration services only.
- [x] Final local automated and visual verification recorded in docs/MINIMAL_RELEASE.md.
- [ ] User review with real launch projects and photographs.
- [ ] Target Linux image, HTTPS, volumes and production acceptance.

Implementation is local only. Deployment, spreadsheet import, backup infrastructure and a new visual direction are outside this change. No live deployment is authorized by this checklist.

## Google Play preparation

Follow `docs/GOOGLE_PLAY_SUBMISSION_PLAN.md`; confirmed identity/scope decisions are in `docs/PHASE_0_DECISIONS.md`. Phase 0 remains open for Play registration/verification and operating decisions; independent Phase 1 engineering is authorized. Phase 1 implementation and verification are recorded in `docs/PHASE_1_WEB_READINESS.md`. Android hardware validation follows packaging; local viewport tests do not close that later gate.
