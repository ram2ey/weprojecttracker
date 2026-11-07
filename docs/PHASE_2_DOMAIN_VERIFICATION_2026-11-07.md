# Permanent-domain verification — 7 November 2026

The approved domain is now configured for the **existing deployed application**. This infrastructure change does not release the reduced register candidate: draft PR #1 remains unmerged, and no app image references or database migrations were changed.

## Applied configuration

| Setting          | Result                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Canonical origin | https://wassaeastprojecttracker.com                                                                             |
| Main DNS         | `@ A 46.62.214.164`, TTL 3600                                                                                   |
| www DNS          | `www A 46.62.214.164`, TTL 3600                                                                                 |
| Coolify target   | Existing service `pnj4g33ejfgwgpgqkqbeol3v`, **web**, internal port 3000                                        |
| Redirects        | HTTP→HTTPS and www→apex, currently HTTP 307; path and query preserved                                           |
| App environment  | Existing `APP_URL` changed from the demo origin to the canonical origin                                         |
| Activation       | Current-version app-only restart; one further app-only retry after DNS propagation to issue the www certificate |

The obsolete parking A records were removed after replacement records existed. Registrar rows now contain only the new server address for both website names. Zoho MX priorities 10/20/50, SPF, DKIM, ownership TXT, Domain Connect TXT and nameservers were preserved. No mail settings, secrets, account passwords, database/media volumes, shared proxy configuration or shared proxy restart were changed. The separate Cloudflare connector remains running.

## Verification

- Authoritative nameservers and public resolvers **1.1.1.1 / 8.8.8.8** return only `46.62.214.164` for www after cleanup. The apex also resolves to the server.
- Both hostnames pass normal TLS certificate validation against the target server. No certificate warning or verification check was bypassed.
- Main HTTPS returns 200 for `/`, `/about`, `/staff/login`, `/sitemap.xml`, `/robots.txt` and `/api/ready`; readiness is `true`.
- HTTP preserves `/projects?test=redirect` when redirecting to HTTPS. HTTPS www preserves `/about?test=redirect` when redirecting to the apex.
- Public www lookup through Google's DNS-over-HTTPS resolver reaches `46.62.214.164`, validates TLS successfully and returns the expected 307 apex redirect. The local default resolver still had cached parking answers during verification; its failed request reached `172.232.24.235`. Those old answers expire with their cached TTL. No system DNS settings or caches were changed.
- Canonical and Open Graph URLs use the permanent origin. Sitemap uses the permanent origin and contains no old tunnel hostname.
- The demo connector's readiness still returns `true`. Coolify shows web/database healthy, migration exited, old worker retained, and this app's pending configuration indicator cleared after restart.

The first www certificate attempt failed against an old parking address. After authoritative and two public resolvers agreed on the new address, one app-only retry succeeded. The shared proxy's pre-existing pending changes remain untouched.

## Remaining release gates

The public site still displays the older application's Home/Updates/Following/maps interface. The approved minimal register, username/account conversion, retired worker/endpoints and migration-success readiness marker remain in the draft candidate for the coordinated Phase 4 release. Do not describe the current live app as the reduced release.

Final-host staff login/cookies, the reduced publishing/media workflow, trusted forwarding/rate limits, expected-release deployment polling and monitoring activation must be checked with that release. `MONITOR_ENABLED=false`: the new monitor requires the candidate's release/migration marker and its workflow must be on the default branch. User-approved GitHub Actions notifications remain the selected channel.

Backups, recovery targets and restore testing remain explicitly deferred. Phase 2's engineering and domain setup are complete, but the full recovery/release exit gate is not closed.

Ignored proof images: `.local/phase2-dns-final-2026-11-07.png`, `.local/phase2-public-domain-2026-11-07.png`.
