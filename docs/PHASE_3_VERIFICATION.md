# Phase 3 verification

Date: 29 October 2026.

## Result and scope

Public discovery is implemented locally. Visitors can filter and browse approved projects, inspect evidence/history, explore published locations with MapLibre, and read announcements and public reports without signing in.

The user explicitly requested **no Contact page for now** and **a clear map fallback until a Geoapify key is available**. Contact is omitted. The directory and fallback are usable without a map key; live Geoapify tile delivery remains an environment acceptance item.

## Implemented

- Homepage recent projects, approved photos when available, visible illustration labels, category shortcuts, and database-wide counts. Counts include all approved records rather than the latest 100 cards. Public layout and metadata share request-scoped reads without introducing cross-request caches.
- Keyword/tag, category, subcategory, community, status, approved-update date range, sorting, and 24-record pagination. URLs preserve filter choices and view. Invalid ranges/inputs and empty/out-of-range results have explicit states. Facets include names preserved in approved snapshots, including historical names.
- Opt-in map loading; MapLibre and its worker bundled locally; attributed Geoapify OSM Carto raster configuration when available. Public map responses use the same filters and explicit summary fields. Clusters support click/keyboard zoom, and a project selector provides a keyboard alternative to canvas interactions. Reduced-motion preferences are respected.
- Missing key, no coordinates, sample records, failed requests, and unsupported rendering fall back to the directory. No exact project locations are invented. The map includes up to 1,000 markers with a notice when truncated; unlocated projects remain in the directory.
- Project details with current objectives, progress, milestones, dates, attribution, location context, tags, documents, video/reference links, and preserved approved history. Photos support native modal enlargement, previous/next navigation, Escape dismissal, and full-image links. Sharing uses native share where available, otherwise clipboard or a selectable link.
- Announcement/report indexes and public-information navigation. About explains reported progress and independent review. Contact remains deferred.
- Canonical metadata, approved-only social preview PNGs, escaped structured data, a dynamic sitemap, and environment-aware robots rules. Local/test indexing is disabled. Production permits social preview-image crawlers while excluding administrative/private API surfaces.
- Record withdrawal removes project pages, media, social-image responses, map points, and sitemap entries on new requests. Public financial fields and private storage/contributor information remain excluded.

## Checks

- `npm test`: **12 tests pass**, covering existing security/content validation plus public filters and crawler rules.
- `npm run test:e2e`: **23 scenarios pass** against the packaged standalone server with the isolated `wassa_test` database. Five new scenarios cover combined filters/pagination, full counts beyond 100 projects, map API filtering/privacy, opt-in fallback behavior, actual MapLibre clustering/keyboard selection, galleries/sharing, metadata/social-image generation, publication indexes, and withdrawal across public surfaces. The existing 18 foundation/publishing regressions pass.
- `npm run lint` and `npm run typecheck`: pass.
- `node scripts/build-production.mjs`: clean production build passes with database/authentication/MFA/Google/map credentials excluded from the build environment.
- `node scripts/check-production.mjs`: packaged production fixture isolation passes.
- Desktop local directory inspected in Chrome after restarting a stale development module cache. Real discovery and map screenshots are generated in `.local/phase3-directory-mobile.png` and `.local/phase3-map-desktop.png`. The mobile directory has no horizontal overflow at 390px.
- Test map rendering uses a local background style and synthetic coordinates in the test database. This verifies MapLibre, clustering, bundled worker, selection, and reduced-motion behavior; it does **not** verify Geoapify network tiles or real constituency locations.

Test fixtures contain 105 approved projects, separate draft/pending/withdrawn records, two public publication records, and temporary evidence. They are isolated from the development operator and are removed from the test database afterward. Ignored test-media artifacts can remain locally.

## Remaining acceptance

- Add an origin-restricted `GEOAPIFY_API_KEY`, restart the service, and verify actual Geoapify tiles, attribution, CSP, and quota behavior. No map account, payment, or paid upgrade was created.
- Supply approved real branding, project data, photographs, community names, and coordinates. Current local design samples remain explicitly labelled and are never plotted as real evidence.
- Full WCAG 2.2 AA, cross-browser/mobile, performance/load, and deployment acceptance remain Phase 5. Keyboard/overflow checks here are not a full accessibility certification.
- Live Google OAuth and Linux Docker/Coolify/volume validation remain outstanding foundation checks. No remote deployment was performed.
- Third-party social networks can retain images already fetched; new requests to this application's withdrawn-image endpoint return 404. Sitemap output is bounded to 49,000 published records; a sitemap index is needed before that scale.
- Contact remains deferred unless the user requests it. Engagement, notifications, exports, and PWA remain Phase 4.

## References

- [MapLibre installation and bundled worker configuration](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre clustering example](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)
- [Geoapify map tiles and attribution](https://apidocs.geoapify.com/docs/maps/map-tiles/)
