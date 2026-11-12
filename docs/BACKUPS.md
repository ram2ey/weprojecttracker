# Nightly backups — Wassa East project register

Decided **10 November 2026**: nightly encrypted off-site backups of the database and all photographs, using a `backup` service in the Compose definition, [restic](https://restic.readthedocs.io/) and **Backblaze B2**.

| Setting    | Value                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time       | 02:00 GMT (UTC) every night; one automatic retry 30 minutes after a failure                                                                                             |
| Contents   | `pg_dump` of the `wassa` database (custom format) plus the whole media volume, and a manifest                                                                           |
| Retention  | 14 daily, 8 weekly and 6 monthly copies; older copies are deleted automatically                                                                                         |
| Encryption | Client-side by restic before upload. Backblaze stores only encrypted data                                                                                               |
| Storage    | Only changed data is uploaded each night (deduplicated), so photos are not re-sent                                                                                      |
| Integrity  | Each dump is checked with `pg_restore --list` before upload; `restic check` runs every Sunday                                                                           |
| Status     | Each success or failure is written to the audit log (`backup.completed` / `backup.failed`), visible to operators under **Audit**. `/api/ready` reports only `backup: ok | stale | none` |
| Alerting   | The uptime monitor fails when the last success is older than 36 hours, and also when none exists if `REQUIRE_BACKUP=true`                                               |
| Tested     | Every release's CI container check runs a real backup, restores it, restores the database into a scratch database and compares row counts                               |

Until the settings below exist, the backup service starts and waits, logging once an hour that backups are not configured. Deployments are unaffected.

## The recovery password

The backups are encrypted with `BACKUP_PASSWORD`. **Without it, no backup can ever be restored, by anyone.** It is kept in two places (decided 10 November 2026):

1. Coolify's secret settings for this service (used every night).
2. The office password manager, or a sealed printed note in a locked place. This copy is for when the server or the Coolify account is lost.

Generate it once, at least 32 random characters. Never put it in Git, chat, email or a document. If it is ever exposed, see _Changing the password_ below.

## One-time setup (office account owner)

These steps involve creating an account, accepting terms, billing choices and secret values, so the account owner does them personally.

1. **Backblaze account.** Sign up at backblaze.com with an office-controlled email, turn on two-factor sign-in, and choose a region. The first 10 GB are free. Under **Caps & Alerts**, set a small daily cap and an alert email so a mistake cannot run up charges.
2. **Bucket.** Create a bucket, for example `wassa-east-backups-<random>`: **Private**, encryption **Enabled (SSE-B2)**, Object Lock off. Under **Lifecycle settings**, choose _Keep only the last version of the file_; restic manages its own history.
3. **Application key.** Under **Application Keys → Add a New Application Key**: allow access to **this bucket only**, type **Read and Write**, no expiry. Copy the _keyID_ and _applicationKey_ straight into step 5. Backblaze shows the application key only once.
4. **Endpoint.** On the bucket's page, note the S3 endpoint, for example `s3.eu-central-003.backblazeb2.com`.
5. **Coolify.** In the service's environment variables, add (as secrets where offered):

   | Variable                 | Value                                                            |
   | ------------------------ | ---------------------------------------------------------------- |
   | `BACKUP_REPOSITORY`      | `s3:https://<endpoint>/<bucket>/wassa-east`                      |
   | `BACKUP_PASSWORD`        | the recovery password, also saved in the office password manager |
   | `BACKUP_KEY_ID`          | the key's _keyID_                                                |
   | `BACKUP_APPLICATION_KEY` | the key's _applicationKey_                                       |

   Then redeploy, or restart only the `backup` container.

6. **First backup now.** In Coolify, open a terminal in the `backup` container and run:

   ```bash
   node scripts/backup.mjs once
   ```

   It creates the encrypted repository on first use. Expect `Backup completed: snapshot …`.

7. **Prove it restores.** In the same terminal:

   ```bash
   RESTORE_CHECK_DATABASE=1 node scripts/backup.mjs restore-check
   ```

   This downloads the latest copy into temporary storage, checks the dump and the photo count against the manifest, restores the database into a throwaway database (`wassa_restore_check_…`), compares row counts with the live database, then deletes the throwaway copy. The live database is only read.

8. **Turn on alerting.** In GitHub, set the repository variable `REQUIRE_BACKUP=true`. The uptime monitor then fails if no successful backup exists or the last one is over 36 hours old.
9. **Record it.** Note the date, the first snapshot ID and the restore-check result in the delivery records. Do not record any secret.

The privacy page switches automatically to describing off-site encrypted copies once the first backup has completed.

## Routine checks

- **Monthly:** run the step 7 restore check, and look at **Audit** in the staff workspace for `backup.failed` entries.
- **Every 6 months:** confirm the office's copy of the recovery password still matches. Run a restore check using it from a separate machine with restic installed (see below).

## Full disaster recovery

Use this if the server, database or media volume is lost. Restore into a **new, isolated** environment first, never over a live database.

1. Prepare a host with Docker, the same Compose definition and the last known good `WEB_IMAGE` / `TOOLS_IMAGE` pair (from the release workflow summary). Do not start `web` yet.
2. Provide the four `BACKUP_*` values, using the office copy of the password if Coolify is unavailable.
3. List the copies, then restore the chosen one, from a `backup` container (the `tools` image includes restic and the PostgreSQL 16 client):

   ```bash
   restic snapshots --host wassa-east
   restic restore <snapshot-id or latest> --host wassa-east --target /tmp/restore
   ```

   The dump is at `/tmp/restore/tmp/wassa-backup/database.dump`, the photos are under `/tmp/restore/data/media/`, and `manifest.json` records the date, release and photo count.

4. Restore the database into the new, empty `wassa` database:

   ```bash
   pg_restore --no-owner --no-acl --exit-on-error --dbname wassa /tmp/restore/tmp/wassa-backup/database.dump
   ```

5. Copy the photos into the new media volume, preserving ownership `1001:1001`. The backup container mounts media read-only, so use a one-off container with the volume writable.
6. Start `migrate` (a no-op if the schema is current), then `web`. Check `/api/ready`, sign in as an operator, open a project with photos and check the audit log.
7. Only then point the domain at the restored environment. Staff sessions from before the loss are not valid; staff sign in again.

What is **not** in the backups: Coolify settings and secrets (`BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `BACKUP_*`). Keep those in the office password manager too. If `BETTER_AUTH_SECRET` is lost, existing staff sessions end, but passwords still work.

## Changing the password or key

- **Application key:** create a new bucket-only key in Backblaze, update `BACKUP_KEY_ID` / `BACKUP_APPLICATION_KEY`, restart `backup`, run `node scripts/backup.mjs once`, then delete the old key.
- **Recovery password:** restic supports several passwords per repository. From the backup container run `restic key add`, enter the new password, update `BACKUP_PASSWORD` and the office copy, verify with a restore check, then remove the old one with `restic key list` and `restic key remove <id>`.

## Restoring from your own computer

Install restic, then set `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the shell, and run the same `restic snapshots` / `restic restore` commands. Restore to an encrypted or private folder: the files include staff password hashes and private project history.
