# Wassa East design system

Status: implemented direction for client review; branding remains provisional.

## Direction

A calm civic publication, open to every constituent. Recent work and evidence lead. Warm paper surfaces, deep green navigation and actions, muted botanical accents, and a restrained red detail provide identity without overwhelming the information.

- Body/interface: locally hosted DM Sans Variable.
- Headlines: locally hosted Newsreader Variable, with limited italic emphasis.
- Background: `#fcfcf9`; text: `#263c32`; primary: `#214e3b`; supporting text: `#5b685a`; border: `#dce1d8`.
- 4/8-pixel spacing rhythm. Containers widen to 1240px; mobile gutters are 20px.
- Small, consistent radii; thin borders; minimal shadows; no decorative motion.
- Lucide icons throughout. Text accompanies statuses and navigation; colour alone never communicates status.
- Visible focus outlines, skip link, labelled controls, semantic headings, reduced-motion support, and 44px interaction targets where practical.

## Screens for review

- `/`: homepage with recent work, sector links, statistics, featured project, and project directory entry points.
- `/projects`: searchable and filterable directory.
- `/projects/classroom-block`: sample project profile and progress history.
- `/preview/console`: approval dashboard design, isolated from operational admin access.
- `/preview/console?view=new`: project submission form design.
- `/preview/console?view=review`: review queue design.
- `/preview/console?view=team`: staff invitation/recovery interface preview.
- `/staff/login`, `/staff/security`, `/staff/setup`: real authentication flow screens.

Sample project records and SVG illustrations are explicitly labelled and are not documentary evidence. Preview content is disabled in production. Supplied approved logos, photographs, contacts, and the final product name replace the placeholders before launch.

The public site uses responsive header navigation plus mobile bottom navigation. The administrative console uses a sidebar on larger screens and compact navigation on mobile. Operational project persistence and publication are Phase 2 work; preview form actions never claim to save real records.
