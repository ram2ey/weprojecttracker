# Wassa East Projects

Constituency project tracking and public information platform. See [PROJECT_PLAN.md](PROJECT_PLAN.md) for scope and progress, [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for the visual direction, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for setup and operations.

Phase 4 adds moderated guest engagement, private corrections/feedback, independently reviewed replies, device follows, staff inboxes, overdue reminders, internal exports, public report drafts, and opt-in offline reading. Browser push is implemented but live delivery remains disabled at the user's request. See [Phase 4 verification](docs/PHASE_4_VERIFICATION.md), [Phase 3 verification](docs/PHASE_3_VERIFICATION.md), [Phase 2 verification](docs/PHASE_2_VERIFICATION.md), and [Phase 1 acceptance](docs/PHASE_1_VERIFICATION.md). Local review precedes one production deployment, with no staging environment.

## Start locally

```text
npm ci
npm run db:local
npm run db:migrate
npm run dev
```

On a new installation, create the first operator with `npm run staff:bootstrap -- your-email@example.com "Your name"`. No shared password or default admin account is installed. At the user's request, this local development database now has a **Platform operator** account (`operator@wassa-east.local`); its private one-use setup link was handed over in the chat. This does not create a production account.

Public preview: `http://localhost:3000`

Admin design review: `http://localhost:3000/preview/console`

Real staff access: `http://localhost:3000/staff/login`

Device follows, offline preferences, and installation: `http://localhost:3000/following`. Follows and read status do not synchronise between browsers. The real staff workspace now includes Comments & feedback, Your inbox, and Reports & exports. Comments and official replies require independent review. Public report PDFs use a separate public-data projection and remain private drafts until approved.

Run `npm run worker` alongside the web server for reminders and retention. `npm run push:keys` creates an ignored `.local/vapid.env` once, without enabling notifications. Never commit its private key. Offline reading requires explicit opt-in and saves only bounded public copies, with saved-time/staleness notices; all submissions and staff changes require a connection.

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The real workspace is `/admin`. Operators manage staff links and categories/communities; officers create projects, announcements, and reports; an independent approver publishes or returns them with a reason. No role can approve a revision they prepared or submitted. Financial fields and financial documents remain staff-only. Uploaded images are optimised with metadata removed; PDFs are validated and served as downloads.

The public site reads only approved snapshots. The previous publication remains while a revision is pending. Record and attachment withdrawals block public access immediately, including map, sitemap, and preview-image responses. Local sample projects appear only when the content register is empty and design preview is enabled; production never serves sample records.

Browse `/projects` with keyword, category, subcategory, community, status, approved-update-date filters, and sorting. Switch to map view and explicitly load the map to explore published locations. The list always includes projects without coordinates. `/announcements` and `/reports` list approved publications. Contact is deferred at the user's request.

Add an origin-restricted Geoapify browser key as `GEOAPIFY_API_KEY` and restart the application to enable live tiles. Without a key, the map shows a clear fallback and the directory remains functional. No key or paid map account is bundled. See deployment notes before enabling it.

For an additional credential-free compilation check, run `node scripts/build-production.mjs`, then `node scripts/check-production.mjs` against the isolated local database. Runtime secrets are still required to start the server.
