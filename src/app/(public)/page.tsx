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
      "Project register",
      "Explore approved projects and photographs across Wassa East.",
      "/",
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
  return (
    <div className="container section directory">
      <div className="page-heading">
        <span className="eyebrow">WASSA EAST CONSTITUENCY</span>
        <h1>Project register</h1>
        <p>
          Explore the work in your community and its latest approved
          information.
        </p>
      </div>
      <form
        key={filterQuery(filters)}
        action="/"
        className="register-filters"
        aria-label="Filter projects"
      >
        <label>
          Search projects
          <input
            name="q"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Project title, code or community"
          />
        </label>
        <FilterPanel count={chips.length}>
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
          <Link href="/" className="text-link">
            Clear filters
          </Link>
        </p>
      )}
      {!!chips.length && (
        <nav className="active-filters" aria-label="Active filters">
          {chips.map(([k, label]) => (
            <Link
              key={k}
              href={
                "/?" + filterQuery(filters, { [k]: undefined, page: undefined })
              }
              aria-label={
                "Remove " + label.toLowerCase() + " filter: " + filters[k]
              }
            >
              {label}: {filters[k]} ×
            </Link>
          ))}
          <Link href="/">Clear all</Link>
        </nav>
      )}
      <p role="status" className="results-count">
        {listing.total} {listing.total === 1 ? "project" : "projects"}
      </p>
      <div className="project-grid">
        {listing.items.map((r) => (
          <ProjectCard key={r.id} project={r} />
        ))}
      </div>
      {!listing.items.length && result.success && (
        <div className="empty-state">
          <h2>
            {listing.total
              ? "This page has no projects."
              : "No published projects found."}
          </h2>
          <p>
            {listing.total
              ? "Return to the first page of results."
              : "Try another search or check back for approved projects."}
          </p>
          <Link
            className="button button-outline"
            href={
              listing.total ? "/?" + filterQuery(filters, { page: "1" }) : "/"
            }
          >
            {listing.total ? "First page" : "Clear filters"}
          </Link>
        </div>
      )}
      {listing.total > 0 && (
        <nav className="pagination" aria-label="Project pages">
          {filters.page > 1 && (
            <Link
              href={
                "/?" + filterQuery(filters, { page: String(filters.page - 1) })
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
                "/?" + filterQuery(filters, { page: String(filters.page + 1) })
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
