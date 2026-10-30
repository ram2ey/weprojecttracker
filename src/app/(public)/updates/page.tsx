import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isSampleDataset } from "@/lib/content/showcase";
import { publicProjects } from "@/lib/projects";
import { listPublicContent } from "@/lib/content/public";
import { pageMetadata } from "@/lib/site";
export const metadata = pageMetadata(
  "Latest updates",
  "The latest approved project developments, announcements and public reports from Wassa East.",
  "/updates",
);
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sample = await isSampleDataset();
  const projects = sample ? publicProjects() : [];
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(params.page ?? "1") || 1),
  );
  const listing = sample ? null : await listPublicContent({ page });
  const updates = listing
    ? listing.items.map((r) => ({
        id: r.id,
        title: r.payload.title,
        updated: new Date(r.publishedAt).toLocaleDateString("en-GB", {
          timeZone: "UTC",
        }),
        category: r.kind === "project" ? r.payload.categoryName : r.kind,
        href: `/${r.kind === "project" ? "projects" : "information"}/${r.slug}`,
        description: r.payload.changeSummary || r.payload.description,
      }))
    : projects.map((p) => ({ ...p, href: `/projects/${p.slug}` }));
  return (
    <div className="container section">
      <nav className="publication-nav" aria-label="Public information">
        <Link href="/updates" aria-current="page">
          All updates
        </Link>
        <Link href="/announcements">Announcements</Link>
        <Link href="/reports">Public reports</Link>
      </nav>
      <div className="page-heading">
        <span className="eyebrow">THE LATEST ON THE GROUND</span>
        <h1>Progress, as it happens.</h1>
        <p>
          A clear record of project developments and constituency announcements.
        </p>
      </div>
      <div className="updates-list">
        {updates.map((project) => (
          <Link className="update-row" key={project.id} href={project.href}>
            <span className="update-date">{project.updated}</span>
            <div>
              <span className="eyebrow">{project.category}</span>
              <h2>{project.title}</h2>
              <p>
                {project.description.slice(0, 240)}
                {project.description.length > 240 ? "…" : ""}
              </p>
            </div>
            <ArrowUpRight size={22} />
          </Link>
        ))}
      </div>
      {!updates.length && (
        <p className="empty-state">Approved updates will appear here.</p>
      )}
      {listing && (
        <nav className="action-row" aria-label="Update pages">
          {page > 1 && <Link href={`/updates?page=${page - 1}`}>Previous</Link>}
          <span>Page {page}</span>
          {page * listing.limit < listing.total && (
            <Link href={`/updates?page=${page + 1}`}>Next</Link>
          )}
        </nav>
      )}
    </div>
  );
}
