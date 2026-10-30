import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  List,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { projectStatuses } from "@/lib/content/types";
import { isSampleDataset, projectCards } from "@/lib/content/showcase";
import { publicProjects, categories as sampleCategories } from "@/lib/projects";
import { listPublicContent } from "@/lib/content/public";
import { discoverySummary } from "@/lib/content/discovery";
import { publicFiltersSchema, filterQuery } from "@/lib/content/filters";
import { ProjectCard } from "@/components/project-card";
import { ProjectMap } from "@/components/discovery/project-map";
import { Button } from "@/components/ui/button";
type Params = Promise<Record<string, string | string[] | undefined>>;
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Params;
}): Promise<Metadata> {
  const query = await searchParams;
  return {
    title: "Explore projects",
    description:
      "Find approved Wassa East projects by sector, community, stage and update date.",
    alternates: { canonical: "/projects" },
    robots: Object.values(query).some(Boolean)
      ? { index: false, follow: true }
      : undefined,
  };
}
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const raw = await searchParams,
    result = publicFiltersSchema.safeParse({ ...raw, kind: "project" });
  const filters = result.success
    ? result.data
    : publicFiltersSchema.parse({ kind: "project" });
  const view = raw.view === "map" ? "map" : "list";
  const sample = await isSampleDataset();
  const all = sample ? publicProjects() : [];
  const summary = sample
    ? {
        categories: sampleCategories,
        subcategories: [] as string[],
        communities: [...new Set(all.map((p) => p.community))].sort(),
      }
    : await discoverySummary();
  const listing =
    !sample && result.success ? await listPublicContent(filters) : null;
  const sampleResults = all.filter(
    (p) =>
      (!filters.q ||
        `${p.title} ${p.description} ${p.community}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())) &&
      (!filters.category || p.category === filters.category) &&
      (!filters.community || p.community === filters.community) &&
      (!filters.status || p.status === filters.status) &&
      !filters.subcategory &&
      (!filters.from ||
        new Date(p.updated).toISOString().slice(0, 10) >= filters.from) &&
      (!filters.to ||
        new Date(p.updated).toISOString().slice(0, 10) <= filters.to),
  );
  if (filters.sort === "title")
    sampleResults.sort((a, b) => a.title.localeCompare(b.title));
  else if (filters.sort === "progress")
    sampleResults.sort((a, b) => b.progress - a.progress);
  else if (filters.sort === "oldest") sampleResults.reverse();
  const projects = !result.success
    ? []
    : listing
      ? await projectCards(listing.items)
      : sampleResults.slice((filters.page - 1) * 24, filters.page * 24);
  const total = result.success ? (listing?.total ?? sampleResults.length) : 0,
    limit = listing?.limit ?? 24,
    pages = Math.max(1, Math.ceil(total / limit));
  const query = (patch: Record<string, string | undefined> = {}) =>
    filterQuery({ ...filters, view }, patch);
  return (
    <div className="container section directory">
      <div className="page-heading">
        <span className="eyebrow">THE PROJECT DIRECTORY</span>
        <h1>Every project. Every step.</h1>
        <p>
          Find the work that matters to your community, and see how it is
          progressing.
        </p>
      </div>
      <form
        className="discovery-filters"
        action="/projects"
        aria-label="Filter projects"
      >
        <input type="hidden" name="view" value={view} />
        <div className="discovery-search">
          <label htmlFor="q">Search projects</label>
          <div className="search-field">
            <Search size={19} />
            <input
              id="q"
              name="q"
              placeholder="Project, community or tag"
              maxLength={200}
              defaultValue={typeof raw.q === "string" ? raw.q : ""}
            />
          </div>
        </div>
        {(
          [
            {
              name: "category",
              label: "Category",
              options: summary.categories,
              empty: "All categories",
            },
            {
              name: "subcategory",
              label: "Subcategory",
              options: summary.subcategories,
              empty: "All subcategories",
            },
            {
              name: "community",
              label: "Community",
              options: summary.communities,
              empty: "All communities",
            },
            {
              name: "status",
              label: "Project status",
              options: projectStatuses,
              empty: "All statuses",
            },
          ] as const
        ).map(({ name, label, options, empty }) => (
          <label key={name}>
            {label}
            <select
              name={name}
              aria-label={label}
              defaultValue={typeof raw[name] === "string" ? raw[name] : ""}
            >
              <option value="">{empty}</option>
              {options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Updated from
          <input
            type="date"
            name="from"
            defaultValue={typeof raw.from === "string" ? raw.from : ""}
          />
        </label>
        <label>
          Updated through
          <input
            type="date"
            name="to"
            defaultValue={typeof raw.to === "string" ? raw.to : ""}
          />
        </label>
        <label>
          Sort by
          <select name="sort" aria-label="Sort by" defaultValue={filters.sort}>
            <option value="newest">Latest approved update</option>
            <option value="oldest">Oldest approved update</option>
            <option value="title">Project title A–Z</option>
            <option value="progress">Highest reported progress</option>
          </select>
        </label>
        <div className="filter-actions">
          <Button type="submit">
            <SlidersHorizontal size={16} />
            Apply filters
          </Button>
          <Link className="text-link" href="/projects">
            Clear filters <ArrowUpRight size={15} />
          </Link>
        </div>
        <p className="filter-help">
          Dates refer to approved public updates. Drafts and submissions are
          excluded.
        </p>
      </form>
      {!result.success && (
        <p className="form-error" role="alert">
          Please check your filters.{" "}
          {result.error.issues.map((i) => i.message).join(" ")}
        </p>
      )}
      <div className="results-heading">
        <p role="status">
          <strong>{total}</strong> {total === 1 ? "project" : "projects"}
          {filters.category ? ` in ${filters.category}` : " across Wassa East"}
        </p>
        <nav className="view-switch" aria-label="Directory view">
          <Link
            href={`/projects?${query({ view: "list" })}`}
            aria-current={view === "list" ? "page" : undefined}
          >
            <List size={16} />
            List
          </Link>
          <Link
            href={`/projects?${query({ view: "map" })}`}
            aria-current={view === "map" ? "page" : undefined}
          >
            <MapPin size={16} />
            Map
          </Link>
        </nav>
      </div>
      {view === "map" && result.success && (
        <ProjectMap
          key={query({ page: undefined })}
          query={query({ page: undefined, view: undefined })}
          sample={sample}
        />
      )}
      {view === "map" && (
        <h2 className="map-list-heading">Browse the matching projects</h2>
      )}
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {!projects.length && result.success && (
        <div className="empty-state">
          <Search size={30} />
          <h2>{total ? "This page has no projects." : "No projects found."}</h2>
          <p>
            {total
              ? "Return to the first page of these results."
              : "Try a different search or clear your filters."}
          </p>
          {total > 0 && (
            <Link href={`/projects?${query({ page: "1" })}`}>Go to page 1</Link>
          )}
        </div>
      )}
      {total > 0 && (
        <nav className="pagination" aria-label="Project pages">
          {filters.page > 1 && (
            <Link
              className="text-link"
              href={`/projects?${query({ page: String(filters.page - 1) })}`}
            >
              Previous
            </Link>
          )}
          <span>
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages && (
            <Link
              className="text-link"
              href={`/projects?${query({ page: String(filters.page + 1) })}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
