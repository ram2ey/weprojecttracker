# Phase 2 backup and recovery plan

**Implementation update — 10 November 2026:** the user chose nightly encrypted backups through a `backup` Compose service (restic to Backblaze B2) at 02:00 GMT, keeping 14 daily, 8 weekly and 6 monthly copies, with the recovery password held in Coolify and the office password manager. Code, CI restore rehearsal, monitoring and the operator guide are in [BACKUPS.md](BACKUPS.md). Activation still needs the office's Backblaze account, bucket, key and Coolify settings (steps there). Until then the service waits idle and no off-site copy exists.

Web-delivery update — **7 November 2026**: the user separately authorized a one-time **server plus downloaded** pre-release copy. The database dump, empty media archive and recovery notes were created and downloaded with matching checksums; see [the safety-copy record](WEB_RELEASE_SAFETY_COPY_2026-11-07.md). This supersedes earlier statements that no recovery copy is known. A full restore is still untested, and ongoing paid backup setup remains deferred until deployment and client payment. No B2 purchase or scheduled backup was activated.

Prepared **6 November 2026** from the [live read-only audit](PHASE_2_INFRASTRUCTURE_AUDIT_2026-11-06.md). **Deferred by the user on 6 November 2026.** Backblaze B2 remains the selected provider for later setup; account handoff, backup configuration and restore testing are postponed. No paid subscription or data transfer is authorized by recording this plan.

Independent Linux/container, CI and deployment-preparation work can continue. No recovery copy has been demonstrated, and this deferral does not establish recoverability or itself request a production deployment. Revisit the recorded recovery gap when planning release.

## Proposed operating targets — confirm before activating schedules

- Office-owned account and private dedicated backup bucket; no public domain, public listing or public download access.
- Daily database and media recovery copies; proposed maximum data-loss window (RPO) 24 hours and restoration target (RTO) four hours. Ownership/targets still need confirmation with the user.
- Proposed retention: seven recent local copies and 14 daily remote copies, plus a separately retained pre-release recovery set. Review storage use as photographs are added; multiple complete media archives can exceed a free allowance.
- Verify schedule timezone before choosing the daily time. Do not assume dashboard/browser timezone equals the server's scheduler timezone.
- HTTPS transport, verified provider encryption at rest, bucket-restricted credentials and secure credential/recovery storage. Do not put credentials, database dumps or private configuration into Git or chat. Confirm any additional client-side-encryption requirement before implementing it.
- Select an authorized backup-failure notification recipient/channel before enabling notifications. Keep a restore-test record and periodically rehearse it.

## Concrete implementation sequence

1. User creates/signs into an office-controlled Backblaze account using a reachable email and completes authentication/terms personally. Review region, free allowance, paid-overage controls and any requested billing details before activation; do not assume a hard spending cap.
2. Prepare a private bucket and narrowly scoped S3-compatible application key. Confirm the exact bucket/permissions and sensitive-data destination before creating credentials or linking Coolify. The backup contains staff password hashes/account metadata, private revisions and private media where present; it must not be public.
3. Configure and validate the B2 destination in Coolify, without printing secret values. First create an engine-aware backup of the `wassa` PostgreSQL database (custom-format `pg_dump`); do not rely on a live tar copy of PostgreSQL's data directory. Coolify supports service-database backups using the database container's existing `POSTGRES_*` mapping. [Database backup guidance](https://coolify.io/docs/databases/backups).
4. Back up the complete media volume and its ownership/permissions. Existing inventory is empty, but retain an explicit recovery manifest. Before future live archives, account for uploads/publication consistency; if an archive requires stopping containers, agree a short maintenance window first. Do not stop the shared server. [Storage backup limitations](https://coolify.io/docs/core/persistent-storage/storage-mounts/backups).
5. Securely record the matching image pair, schema/migration state and necessary deployment/legacy encryption keys in an approved private recovery store. Git holds code/runbooks, not populated secrets.
6. Verify successful local and B2 copies, checksums, retention settings and actual download access. A success badge alone does not prove application recovery.
7. Restore into an isolated PostgreSQL 16 instance and media directory, with no production/tunnel hostname or live notifications. Verify schema, staff/account hash preservation, revision/media access and application readiness. Rehearse 0004–0006 on this restored copy and verify operator recovery, temporary-password change, independent publication and historical-data retention.
8. Document measured restore time, failed/retried steps and rollback choices. Only then enable agreed recurring schedules and proceed to deployment preparation. Separate image rollback from database restoration; never automatically overwrite the live database on a failed deployment.

## Cost context

Backblaze advertises the first 10 GB of B2 storage free; larger storage and other billable usage may incur charges. Current source: [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing). No checkout or guaranteed future price is recorded. The initial database is 22 MB with no media files, so a small initial retained set is expected to fit well below 10 GB; that is an estimate, not a measured backup size or permanent cost guarantee.

Cloudflare R2 Standard was considered as an alternative, with a documented 10 GB-month free tier and separate operation allowances. It was not selected. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
