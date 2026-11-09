import { ProjectCollection } from "@/components/content/project-preferences";
import Link from "next/link";
import type { Metadata } from "next";
import { listPublicContent, publicCommunities } from "@/lib/content/public";
import {
  publicFiltersSchema,
  parsePageFilters,
  filterQuery,
} from "@/lib/content/filters";
import { fixedCategories } from "@/lib/content/validation";
import { projectStatuses } from "@/lib/content/types";
import { ProjectCard } from "@/components/project-card";
import { FilterPanel } from "@/components/content/filter-panel";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site";
type Params = Promise<Record<string, string | string[] | undefined>>;
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Params;
}): Promise<Metadata> {
  const raw = await searchParams;
  return {
    ...pageMetadata(
      "Projects",
      "Explore approved projects and photographs across Wassa East.",
      "/projects",
    ),
    ...(Object.values(raw).some(Boolean)
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}
export default async function Register({
  searchParams,
}: {
  searchParams: Params;
}) {
  const raw = await searchParams,
    result = parsePageFilters(raw),
    filters = result.success ? result.data : publicFiltersSchema.parse({}),
    [listing, communities] = await Promise.all([
      result.success
        ? listPublicContent(filters)
        : Promise.resolve({ items: [], total: 0, limit: 24, page: 1 }),
      publicCommunities(),
    ]);
  const pages = Math.max(1, Math.ceil(listing.total / 24));
  const chips = (
    [
      ["q", "Search"],
      ["category", "Category"],
      ["community", "Community"],
      ["status", "Status"],
    ] as const
  ).filter(([k]) => filters[k]);
  const panelCount = chips.filter(([key]) => key !== "q").length;
  const resultsHref =
    chips.length || filters.page > 1
      ? "/projects?" + filterQuery(filters)
      : "/projects";
  return (
    <div className="container section directory">
      <h1>Projects</h1>
      <form
        key={filterQuery(filters)}
        action="/projects"
        className="register-filters"
        aria-label="Filter projects"
      >
        <label>
          Search projects
          <input
            name="q"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Project title or community"
          />
        </label>
        <FilterPanel count={panelCount}>
          <div className="filter-grid">
            {[
              {
                name: "category",
                label: "Category",
                options: fixedCategories.map((c) => c.name),
              },
              { name: "community", label: "Community", options: communities },
              {
                name: "status",
                label: "Status",
                options: [...projectStatuses],
              },
            ].map(({ name, label, options }) => (
              <label key={name}>
                {label}
                <select
                  aria-label={label}
                  name={name}
                  defaultValue={
                    filters[name as "category" | "community" | "status"] ?? ""
                  }
                >
                  <option value="">
                    {name === "category"
                      ? "All categories"
                      : name === "community"
                        ? "All communities"
                        : "All statuses"}
                  </option>
                  {options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </FilterPanel>
        <Button type="submit">Search projects</Button>
      </form>
      {!result.success && (
        <p role="alert" className="form-error">
          Please check your filters.{" "}
          <Link href="/projects" className="text-link">
            Clear filters
          </Link>
        </p>
      )}
      {chips.length > 0 && (listing.items.length > 0 || chips.length > 1) && (
        <nav className="active-filters" aria-label="Active filters">
          {chips.map(([k, label]) => (
            <Link
              key={k}
              href={
                "/projects?" +
                filterQuery(filters, { [k]: undefined, page: undefined })
              }
              aria-label={
                "Remove " + label.toLowerCase() + " filter: " + filters[k]
              }
            >
              {label}: {filters[k]} ×
            </Link>
          ))}
          {chips.length > 1 && listing.items.length > 0 && (
            <Link href="/projects">Clear all</Link>
          )}
        </nav>
      )}
      <ProjectCollection count={listing.total}>
        {listing.items.map((r) => (
          <ProjectCard key={r.id} project={r} resultsHref={resultsHref} />
        ))}
      </ProjectCollection>
      {!listing.items.length && result.success && (
        <div className="empty-state">
          <h2>
            {listing.total
              ? "This page has no projects."
              : chips.length
                ? "No projects match your search."
                : "No published projects yet."}
          </h2>
          <p>
            {listing.total
              ? "Return to the first page of results."
              : chips.length
                ? "Try a different keyword or remove a filter."
                : "Check back for approved projects."}
          </p>
          {(listing.total > 0 || chips.length > 0) && (
            <Link
              className="button button-outline"
              href={
                listing.total
                  ? "/projects?" + filterQuery(filters, { page: "1" })
                  : "/projects"
              }
            >
              {listing.total
                ? "First page"
                : panelCount
                  ? "Clear filters"
                  : "Clear search"}
            </Link>
          )}
        </div>
      )}
      {pages > 1 && listing.items.length > 0 && (
        <nav className="pagination" aria-label="Project pages">
          {filters.page > 1 && (
            <Link
              href={
                "/projects?" +
                filterQuery(filters, { page: String(filters.page - 1) })
              }
            >
              Previous
            </Link>
          )}
          <span>
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages && (
            <Link
              href={
                "/projects?" +
                filterQuery(filters, { page: String(filters.page + 1) })
              }
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
