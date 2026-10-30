import Link from "next/link";
import { ArrowUpRight, FileText, Radio } from "lucide-react";
import { listPublicContent } from "@/lib/content/public";
import { publicFiltersSchema, filterQuery } from "@/lib/content/filters";
export async function PublicationIndex({
  kind,
  searchParams,
}: {
  kind: "announcement" | "report";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    parse = publicFiltersSchema.safeParse({ ...raw, kind }),
    filters = parse.success ? parse.data : publicFiltersSchema.parse({ kind });
  const listing = parse.success
    ? await listPublicContent(filters)
    : { items: [], total: 0, page: 1, limit: 24 };
  const report = kind === "report";
  return (
    <div className="container section">
      <nav className="publication-nav" aria-label="Public information">
        <Link href="/updates">All updates</Link>
        <Link href="/announcements" aria-current={!report ? "page" : undefined}>
          Announcements
        </Link>
        <Link href="/reports" aria-current={report ? "page" : undefined}>
          Reports
        </Link>
      </nav>
      <div className="page-heading">
        <h1>{report ? "Reports" : "Announcements"}</h1>
      </div>
      <form
        className="publication-search"
        action={report ? "/reports" : "/announcements"}
      >
        <label>
          Search {report ? "reports" : "announcements"}
          <input
            name="q"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Search by title or keyword"
          />
        </label>
        <button className="button button-outline" type="submit">
          Search
        </button>
      </form>
      {!parse.success && (
        <p className="form-error" role="alert">
          Please check your search filters.
        </p>
      )}
      <p className="subtle-note">
        {listing.total} approved {report ? "reports" : "announcements"}
      </p>
      <div className="publication-grid">
        {listing.items.map((r) => (
          <article className="publication-card" key={r.id}>
            {report ? <FileText size={25} /> : <Radio size={25} />}
            <span className="eyebrow">
              {r.code} ·{" "}
              {new Date(r.publishedAt).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
            </span>
            <h2>
              <Link href={`/information/${r.slug}`}>{r.payload.title}</Link>
            </h2>
            <p>
              {r.payload.description.slice(0, 240)}
              {r.payload.description.length > 240 ? "…" : ""}
            </p>
            <Link href={`/information/${r.slug}`} className="text-link">
              {report ? "Read report" : "Read announcement"}
              <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
      {!listing.items.length && (
        <div className="empty-state">
          <FileText size={30} />
          <h2>No {report ? "reports" : "announcements"} found.</h2>
          {filters.q && <p>Try a different search.</p>}
        </div>
      )}
      {listing.total > 0 && (
        <nav className="pagination" aria-label="Publication pages">
          {filters.page > 1 && (
            <Link
              href={`?${filterQuery(filters, { page: String(filters.page - 1) })}`}
            >
              Previous
            </Link>
          )}
          <span>
            Page {filters.page} of {Math.ceil(listing.total / 24)}
          </span>
          {filters.page * 24 < listing.total && (
            <Link
              href={`?${filterQuery(filters, { page: String(filters.page + 1) })}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
