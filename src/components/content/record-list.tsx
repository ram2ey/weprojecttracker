import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { AdminRecordSummary } from "@/lib/content/types";
import { canSubmit, type Role } from "@/lib/security/policy";
export function RecordList({
  items,
  view,
  page,
  hasMore,
  role,
  q,
}: {
  items: AdminRecordSummary[];
  view: string;
  page: number;
  hasMore: boolean;
  role: Role;
  q: string;
}) {
  const query = new URLSearchParams({ view, q });
  return (
    <>
      <div className="console-heading">
        <h1>{view === "review" ? "Review queue" : "Project register"}</h1>
        {canSubmit(role) && (
          <Link href="/admin?view=new" className="button button-primary">
            New project
          </Link>
        )}
      </div>
      <form action="/admin" className="register-filters">
        <input type="hidden" name="view" value={view} />
        <label>
          Search register
          <input
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder="Title, code or community"
          />
        </label>
        <button type="submit" className="button button-outline">
          Search
        </button>
      </form>
      <div className="table-panel">
        <div
          className="table-scroll"
          role="region"
          aria-label="Project register table"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Workflow</th>
                <th>Publication</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={
                        "/admin/content/" + r.id + "?revision=" + r.revisionId
                      }
                    >
                      {r.title}
                    </Link>
                    <small>
                      {r.code} · {r.community}
                    </small>
                  </td>
                  <td>
                    <Badge>{r.state}</Badge>
                  </td>
                  <td>
                    {r.withdrawn
                      ? "Withdrawn"
                      : r.published
                        ? "Published"
                        : "Private"}
                  </td>
                  <td>{r.updatedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <p className="empty-state">
            {q && view === "review" ? (
              <>
                No submissions match “{q}”.{" "}
                <Link className="text-link" href="/admin?view=review">
                  Clear search
                </Link>
              </>
            ) : page > 1 ? (
              "No projects on this page."
            ) : view === "review" ? (
              "No submissions awaiting review."
            ) : (
              "No matching projects."
            )}
          </p>
        )}
      </div>
      {(page > 1 || hasMore) && (
        <nav className="pagination" aria-label="Register pages">
          {page > 1 && (
            <Link href={"/admin?" + query + "&page=" + (page - 1)}>
              Previous
            </Link>
          )}
          <span>Page {page}</span>
          {hasMore && (
            <Link href={"/admin?" + query + "&page=" + (page + 1)}>Next</Link>
          )}
        </nav>
      )}
    </>
  );
}
