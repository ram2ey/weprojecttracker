# Phase 1 verification

Date: 29 October 2026.

This is the Phase 1 verification snapshot. Phase 2 subsequently added persistence and publishing, and a local operator was created at the user's request; see `PHASE_2_VERIFICATION.md` for current implementation status. The outstanding Google OAuth and Linux/Coolify acceptance checks still apply.

## Result

The local application foundation is implemented and ready for design review. Phase 1 acceptance remains open for design approval, real Google OAuth verification, and target-host deployment validation. No separate staging environment is required, following the operator's instruction.

## Verified locally

- TypeScript: `npm run typecheck` passes.
- ESLint: `npm run lint` passes without warnings.
- Security tests: `npm test` passes all six cases.
- Browser/integration tests: `npm run test:e2e` passes all 11 cases against the packaged standalone production server, using an isolated test database and locally enabled design fixtures.
- Production compilation: succeeds with database credentials, authentication secrets, MFA keys, and Google credentials absent from the build environment.
- Production isolation: a local standalone server with `APP_ENV=production` exposes no sample project records, returns 404 for `/preview/console`, and returns 404 for sample project URLs.
- PostgreSQL migrations applied to isolated local development and test databases.
- pg-boss worker started successfully and registered its maintenance queue and schedule.
- Desktop and 390px mobile previews checked; mobile home and console do not overflow horizontally.
- Automated axe-core checks on homepage, admin overview preview, and staff sign-in each report zero violations after contrast, landmark, and ARIA fixes. Illustration/gradient contrast and a one-character badge require manual assessment; this is not a complete WCAG certification.

## Security and browser scenarios

- Self-approval is denied for all roles, including the operator.
- First-factor sessions cannot enter the admin workspace or use operator endpoints without an MFA proof.
- A synthetic Google-associated session encounters the same mandatory application MFA gate as a password session.
- Officer accounts cannot generate staff invitations, including after successful MFA.
- Staff deactivation and expired MFA proofs deny access.
- Authenticator secrets reject tampering and incorrect encryption keys.
- Consumed TOTP codes cannot be replayed; expired codes fail.
- Recovery codes work only once, and invalid MFA attempts reach the configured rate limit.
- Foreign-origin MFA requests are denied.
- Public signup and native email password-reset routes are unavailable.
- One-use setup/recovery links store only token hashes; reuse fails, and password recovery revokes existing sessions.
- The complete browser flow succeeds: setup link, password creation, sign-in, authenticator enrolment, recovery-code display, admin entry, and sign-out.
- Public project filtering and detail navigation work with clearly labelled sample data.
- Admin preview form actions explicitly report that no project data is saved.

## Review entry points

- Public design: `http://localhost:3000`
- Directory: `http://localhost:3000/projects`
- Sample profile: `http://localhost:3000/projects/classroom-block`
- Admin overview: `http://localhost:3000/preview/console`
- Submission form: `http://localhost:3000/preview/console?view=new`
- Review queue: `http://localhost:3000/preview/console?view=review`
- Real staff access: `http://localhost:3000/staff/login`

Screenshots from browser checks are in the ignored `.local` directory: `home-mobile.png`, `admin-mobile.png`, and `admin-desktop.png`.

## Outstanding acceptance and future phases

- Approved identity, logos, real photographs, contacts, and representative project records have not been supplied. Existing illustrations and records are explicitly provisional.
- Google OAuth client credentials are not configured. Provider callbacks and account linking must be tested with a real authorised Google identity; synthetic session testing does not establish that external flow.
- Docker is not installed locally. The standalone Node runtime has been verified, but Linux container builds, volume permissions, reverse-proxy behaviour, and Coolify deployment require target-host checks.
- No real operator account was created. The operator should run the documented bootstrap procedure with their actual identity. Test accounts are isolated and cleaned after tests.
- Phase 2 project persistence and publication are not implemented. Maps, engagement, push notifications, exports, PWA caching, automated off-server backups, load testing, and final accessibility/browser acceptance remain in their planned phases.
- No remote server or paid service has been changed or provisioned.
