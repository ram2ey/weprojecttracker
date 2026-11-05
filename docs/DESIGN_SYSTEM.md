# Wassa East design system

## Direction

A quiet, native-feeling civic application. Public project discovery and staff publishing share the same visual language: clear system typography, soft neutral backgrounds, solid content surfaces, restrained green accents, and glass only where navigation floats above content. The existing name, logo and approved evidence remain intact.

## Tokens and appearance

`src/app/globals.css` is the source of truth. Semantic tokens cover background, card, text, secondary text, border, green actions, status colors, glass, sidebar material, radius and shadow. Light uses #f5f6f7 backgrounds, white cards and #176b49 actions; dark uses #141917 backgrounds, #202823 cards and #80d8ab actions with dark labels. Red communicates destructive or critical states, never routine primary actions.

Typography uses the platform system stack. Body text is 1rem, compact metadata is at least .75rem except deliberate eyebrow/navigation labels, and display headings use negative tracking with tight leading. Surfaces use a 4/8px spacing rhythm, .75rem control radii and 1.25–1.75rem content radii. Icons remain Lucide; status text accompanies color.

Appearance defaults to the operating system. The shared Light/Dark/System selector stores an explicit choice under `wassa-appearance`; a small same-origin script applies it before paint. HTML remains identical across public cache entries. Storage failures fall back to a session choice or system appearance; changes synchronize between tabs. The existing CSP is unchanged.

## Layouts

- Public: sticky glass header, prominent project search, compact totals, featured work, categories, project cards and recent approved updates. At widths up to 800px, safe-area-aware bottom navigation and a modal navigation sheet replace desktop links.
- Directory: search and filters share a grouped surface; list/map controls retain query parameters. On mobile, one copy of the filter form lives inside a scrollable sheet with an explicit Apply action.
- Details: title, status, follow/share controls, jump links, readable evidence/history and a sticky progress summary. On small screens the summary precedes the long body.
- Staff: a sticky sidebar, glass toolbar, grouped forms and compact tables. A modal workspace drawer replaces the sidebar below 801px. Save actions remain visible while editing long forms.
- Authentication, reports, discussions, moderation, inbox, preferences, errors and empty states use the same semantic tokens. Exported document layouts are unchanged.

## Interaction and accessibility

Motion is limited to client interaction components; pages and data remain server-rendered. Buttons respond on press. Sheets use interruptible Motion springs, zero bounce by default and a 0.35-second response. The drag handle captures the pointer, tracks release velocity and projects the endpoint; returning from a gesture permits slight overshoot. Native dialogs provide focus containment, Escape dismissal and background inertness. Focus returns to the trigger after dismissal. Gallery opening/closing follows the same spatial path.

Reduced motion removes movement and overshoot; reduced transparency replaces glass with solid surfaces; increased contrast adds defined borders. Keyboard users retain explicit close and apply actions, visible focus, semantic labels, skip links and touch targets of at least 44px for primary controls. Content remains readable without color alone. No sound, haptics or decorative looping motion is used.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:acceptance`. The acceptance command builds the production server and exercises the isolated test database, including public discovery, authenticated publishing, approvals, engagement and accessibility. `tests/e2e/appearance.spec.ts` adds appearance persistence, system preferences, mobile sheets, focus return, drag reversal and reduced-motion checks.

Review public routes and all staff views at phone, tablet and desktop widths in both appearances. Check long forms, empty/error states, evidence captions, scroll boundaries, focus containment and contrast over glass. Sample records and illustrations retain explicit labels and remain disabled in production. No roles, publication rules, API contracts or database schema are changed by the redesign.
