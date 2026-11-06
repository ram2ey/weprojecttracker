# Phase 2 infrastructure audit — 6 November 2026

Status: **read-only inventory complete; recovery and release readiness incomplete**. This is the Google Play roadmap's infrastructure phase, not the historical October `PHASE_2_VERIFICATION.md` feature-development record. No live Compose/environment/domain settings, backup schedules, containers or data were changed. Aggregate database queries ran inside an explicit read-only transaction. The review branch and draft PR remain unmerged.

## Verified live inventory

| Item | Observation |
| --- | --- |
| Platform/resource | Coolify Cloud v4.5.3; Docker Compose Empty service `pnj4g33ejfgwgpgqkqbeol3v`, Wassa East Project Tracker / production, on Hetzner CX43. The server hosts other resources: avoid host-wide restarts, cleanup or unplanned load. |
| Components | Web and PostgreSQL report healthy. The old worker is running with unknown health; the one-shot migrate component is exited. Overall UI reports Running (no healthcheck), so that badge alone is not a release-success gate. |
| Database volume | `pnj4g33ejfgwgpgqkqbeol3v_postgres` mounted at `/var/lib/postgresql/data`. PostgreSQL 16; no host-published database port appears in the saved/generated Compose. |
| Media volume | `pnj4g33ejfgwgpgqkqbeol3v_media` mounted at `/data/media` in web and the old worker. Preserve this exact backing volume when retiring the worker. |
| Runtime access | Web UID/GID 1001:1001. Media directory owner 1001:1001, mode 755, readable/writable by that identity. No write probe was performed. |
| Data inventory | Database size 22 MB; four applied migrations, latest recorded timestamp `1793304898001` (through 0003); zero project records, zero media records and zero media-directory entries. One `super_admin` staff account. No hashes, account identifiers or private project content were retrieved. |
| Capacity | The database mount reports a 150 GB filesystem, about 25 GB used and 120 GB available (17% usage). |
| Current public route | Runtime origin is the existing `https://improved-brussels-limitation-husband.trycloudflare.com` tunnel. `/` and `/api/ready` returned HTTP 200. No custom domain is configured in the Coolify resource. |
| Coolify recovery inventory | Zero backup schedules, zero enabled schedules, zero backup executions, no scheduled tasks and zero team S3 storage destinations. User reports no external backups that they know of. Provider snapshots/manual backups are not independently verified; recoverability is not established. |
| GitHub | Main remains `39819897731b70f09ea91452f5d305aa6fa7fbd0`; no branch protection and no repository rulesets. Draft PR #1 is unmerged. Current main-only workflow runs lint/types/unit checks and image builds; the 69 browser checks are not in CI yet. |

## Current release references

Read from the two nonsecret image fields without changing them:

- Web: `ghcr.io/ram2ey/weprojecttracker-web:sha-39819897731b70f09ea91452f5d305aa6fa7fbd0-42191949662-1`
- Tools: `ghcr.io/ram2ey/weprojecttracker-tools:sha-39819897731b70f09ea91452f5d305aa6fa7fbd0-42191949662-1`

These identify the current configured image pair. They are not proof that reverting images after a database migration is safe; migration recovery requires a compatible verified backup. No digest/container-image-ID comparison was performed in this audit.

## Findings and release gates

1. **P1 — No demonstrated recovery copy; setup deferred by the user.** Coolify has no backups/destination/history and no external backup is known. The user chose on 6 November to postpone backup setup. Private off-server database/media backups and a restore test remain unimplemented; persistent volumes are not recovery evidence. Independent engineering continues with this gap recorded.
2. **P1 — Saved Compose differs from the release candidate.** It retains `worker` and retired MFA/Google/map/render-cache settings. A Git image update does not replace that saved definition. Prepare and review the matching reduced Compose, preserve exact volumes and the working tunnel, then apply it only during an authorized release.
3. **P1 — Production migration/account transition is unrehearsed.** Live storage is through 0003; the candidate needs 0004–0006. Rehearse on a restored copy; verify hashes/history and operator recovery. Migration 0004 revokes sessions and requires password changes; 0005 gives still-temporary credentials a 24-hour window.
4. **P1 — Deployment success is not verified.** For this service the release script accepts the API's started message; it does not prove migration completion or healthy replacement containers, and readiness has no expected-release identifier. Add rollout/migration/release-identity checks and minimal public-route smoke checks.
5. **P2 — CI and branch protection gaps.** Add isolated browser acceptance to GitHub Actions and appropriate required checks before allowing a main merge. Current draft-branch pushes do not run the main-only workflow or deploy.
6. **P2 — Final domain/TLS/proxy acceptance is pending.** No resource domain is configured. Keep the tunnel working until the permanent origin, redirects, secure cookies and trusted-forwarding/rate-limit behaviour are verified.
7. **P2 — Local Docker context needs its generated-output pattern updated.** `.dockerignore` lists `.next`, `.next-test` and `.next-ci`, but not newly named `.next-*` outputs. Exclude all generated build directories before local image builds. Fresh GitHub checkouts do not contain ignored local outputs.

The dashboard initially displayed unsaved-change banners on General/Domains. This audit did not edit, save or reset those forms; confirm intended persisted values during release preparation rather than assuming that banner authorizes a save.

## Recovery plan and next work

The user selected **Backblaze B2** for office-owned off-server storage, then explicitly deferred its setup on 6 November 2026. See [backup and recovery plan](PHASE_2_BACKUP_AND_RECOVERY_PLAN.md). No B2 account, bucket, credential, backup schedule, purchase or data transfer was created by the assistant.

Continue Linux image verification without publishing/deploying, then CI/rollout checks and preparation of the exact saved Compose transition. Backup/restore work is deferred rather than complete. Keep the recovery gap and remaining migration/domain/rollout evidence explicit in any later release decision. Phase 2 is not complete, and no production rollout has been requested by this deferral.

## Evidence

Linux verification completed successfully after the backup deferral: [GitHub Actions run 42237662807](https://github.com/ram2ey/weprojecttracker/actions/runs/42237662807), review branch commit `a85e0df29edd66f418c3c123680d64b975a83f94`. CI lint/type/unit checks and both Linux web/tools image jobs passed. Manual inputs explicitly set `publish=false` and `deploy=false`; the deployment job was skipped. This run does not establish backup/restore readiness or live deployment health.

Ignored local screenshots: `.local/phase2-coolify-backups.png`, `.local/phase2-coolify-volumes.png`, `.local/phase2-database-inventory.png`, `.local/phase2-web-runtime.png`, `.local/phase2-no-s3-storage.png`. Secrets were not recorded in this report or screenshot evidence.

Official references: [Coolify database backups](https://coolify.io/docs/databases/backups), [storage-mount backups and consistency/restore limits](https://coolify.io/docs/core/persistent-storage/storage-mounts/backups), [service persistent storage and volume prefixes](https://coolify.io/docs/services/configuration/persistent-storage).
