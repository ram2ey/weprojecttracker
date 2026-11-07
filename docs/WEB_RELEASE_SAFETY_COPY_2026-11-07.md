# One-time web-release safety copy — 7 November 2026

Status: **created on the existing server and downloaded; archive integrity verified**. The user explicitly selected “Server plus downloaded.” This does not authorize deployment or activate a paid/scheduled backup service.

## Locations and identity

- Server: `/root/wassa-east-release-safety/20261107T091620Z/safety-copy.tar.gz`.
- Download: `C:/Users/admin/Downloads/wassa-east-safety-20261107T091620Z-download.tar.gz`.
- Additional local working copy and extracted recovery notes: `.local/backups/wassa-east-20261107T091620Z/` (ignored by Git).
- Size: **1,384,492 bytes**.
- SHA-256: `a1cdbaa52cdc9ef5a10ff1c22e7d7f8c11a159711537c173c782eac907fe9721`.
- Created: **2026-11-07 09:16:20 UTC**, before any reduced-app production migration.

The root-owned server directory has mode `700`; files were created with `umask 077`. The archive contains staff account metadata/password hashes and should remain private. No public download URL, new server credential or public port was created. Download used the authenticated Coolify file browser. Temporary transfer files were removed from the web container afterward. Two empty failed download artifacts were identified during verification; only the correctly sized, matching-hash download is valid.

## Contents and verification

- `database.dump`: PostgreSQL 16 custom-format `pg_dump` of the live `wassa` database, using the existing database container; no filesystem copy of a running PostgreSQL data directory.
- `media.tar`: archive of the complete media volume, retaining numeric ownership/permissions. The source was empty; directory ownership was `1001:1001`, mode `755`.
- `database-contents.txt`: PostgreSQL archive table of contents.
- `manifest.txt`: timestamp, exact source volumes, current image references/IDs, aggregate record counts and media ownership.
- `RESTORE.txt`: isolated recovery instructions and limits.
- `SHA256SUMS`: checksums for all five content files.

The live read-only inventory found **zero project records, zero media rows and zero uploaded files**. The same counts were recorded after the dump/archive, so no active project/media publication consistency issue was observed. Existing accounts were preserved in the dump; no credentials or row payloads were printed in the report.

Server gzip validation, all five member checksums and the archive checksum passed. The downloaded archive has exactly the same byte count and SHA-256. Local extraction and all five member checksums passed. Local PostgreSQL 16 `pg_restore --list` successfully read the database archive (242 output lines). The media archive contains the empty source directory. Database and web containers remained healthy; no app stop, migration, image change or volume replacement occurred.

## Recovery and limits

Use the private `RESTORE.txt` with the existing operational runbook. First restore into an isolated PostgreSQL 16 database and private media directory; create the role/database through a trusted operator, use `pg_restore --no-owner --no-acl --exit-on-error`, and retain media ownership. Do not overwrite production or reverse migrations based on this record alone.

**A full restore has not been rehearsed.** Archive integrity and readability are verified, not application recovery. Existing Coolify secrets/configuration are not exported in this bundle and must remain available through the trusted operator. This is a point-in-time copy, not continuing protection of later staff changes. Reassess freshness immediately before deployment if data changes or release is delayed. Paid backup setup and Android/email funding remain deferred until the web app is deployed and payment received.

Local UI evidence: `.local/backups/wassa-east-20261107T091620Z/server-verification.png`.
