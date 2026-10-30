import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportData, type ReportFilters } from "@/lib/reports/data";
import { PublicReportGenerator } from "./public-report-generator";
export async function ReportsPanel({
  filters,
  page,
  canPrepare,
}: {
  filters: ReportFilters;
  page: number;
  canPrepare: boolean;
}) {
  const data = await reportData(filters),
    rows = data.rows.slice((page - 1) * 25, page * 25);
  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== false)
      .map(([k, v]) => [k, String(v)]),
  );
  return (
    <>
      <div className="console-heading">
        <div>
          <span className="eyebrow">APPLICATION REPORTS</span>
          <h1>A clear view of the register.</h1>
          <p>
            Internal reports use the latest project revision, including private
            drafts. Counts describe project and moderation records.
          </p>
        </div>
      </div>
      <div className="console-stats">
        {[
          { label: "Matching projects", value: data.total },
          { label: "Overdue updates", value: data.summary.overdueProjects },
          {
            label: "Pending reviews (all content)",
            value: data.summary.pendingReviews,
          },
          {
            label: "Published records (all content)",
            value: data.summary.publishedRecords,
          },
        ].map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
      <form className="report-filter-form" action="/admin">
        <input type="hidden" name="view" value="reports" />
        <label>
          Search register
          <input name="q" defaultValue={filters.q} />
        </label>
        <label>
          Category name
          <input name="category" defaultValue={filters.category} />
        </label>
        <label>
          Community name
          <input name="community" defaultValue={filters.community} />
        </label>
        <label>
          Project status
          <select name="status" defaultValue={filters.status || ""}>
            <option value="">All statuses</option>
            {[
              "Planned",
              "Ongoing",
              "Completed",
              "Delayed",
              "Suspended",
              "Cancelled",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Workflow
          <select name="workflow" defaultValue={filters.workflow || ""}>
            <option value="">All workflows</option>
            {["draft", "pending", "returned", "rejected", "approved"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Last modified from
          <input name="from" type="date" defaultValue={filters.from} />
        </label>
        <label>
          Last modified through
          <input name="to" type="date" defaultValue={filters.to} />
        </label>
        <label>
          Completed from
          <input
            name="completedFrom"
            type="date"
            defaultValue={filters.completedFrom}
          />
        </label>
        <label>
          Completed through
          <input
            name="completedTo"
            type="date"
            defaultValue={filters.completedTo}
          />
        </label>
        <label className="checkbox-label">
          <input
            name="overdue"
            type="checkbox"
            value="true"
            defaultChecked={filters.overdue}
          />
          Only overdue approved updates
        </label>
        <div className="action-row">
          <Button type="submit" variant="outline">
            Apply report filters
          </Button>
          <Link href="/admin?view=reports">Clear</Link>
        </div>
      </form>
      <div className="action-row" aria-label="Internal report downloads">
        {["csv", "xlsx", "pdf"].map((format) => (
          <a
            className="button button-outline"
            key={format}
            href={`/api/staff/reports?${query}&format=${format}`}
          >
            Download internal {format.toUpperCase()}
          </a>
        ))}
      </div>
      <p className="notice">
        Internal exports contain staff-only financial information. Use the
        separate public-report draft workflow for publication.
      </p>
      <div className="report-summaries">
        {(
          [
            { title: "By category", items: data.summary.categories },
            { title: "By status", items: data.summary.statuses },
            { title: "By community", items: data.summary.communities },
            {
              title: "Completion periods",
              items: data.summary.completionPeriods,
            },
          ] as const
        ).map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <dl>
              {group.items.map(([name, count]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
            {!group.items.length && <p>No matching records.</p>}
          </section>
        ))}
      </div>
      <section className="table-panel top-space">
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Project report table"
        >
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Progress</th>
                <th>Workflow</th>
                <th>Last changed</th>
                <th>Update reminder</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/content/${row.id}`}>{row.title}</Link>
                    <small>
                      {row.code} · {row.community}
                    </small>
                  </td>
                  <td>
                    {row.status} · {row.progress}%
                  </td>
                  <td>
                    {row.workflow}
                    {row.withdrawn ? " · withdrawn" : ""}
                  </td>
                  <td>{row.updated.slice(0, 10)}</td>
                  <td>{row.overdue ? "Overdue" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <nav className="pagination" aria-label="Report pages">
        {page > 1 && (
          <Link href={`/admin?view=reports&${query}&page=${page - 1}`}>
            Previous
          </Link>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(data.total / 25))}
        </span>
        {page * 25 < data.total && (
          <Link href={`/admin?view=reports&${query}&page=${page + 1}`}>
            Next
          </Link>
        )}
      </nav>
      <section className="form-section">
        <h2>Feedback & delivery metrics</h2>
        <p>Failed browser-push jobs: {data.summary.failedPushJobs}</p>
        <ul>
          {data.summary.feedback.map((row) => (
            <li key={`${row.kind}:${row.state}`}>
              {row.kind} · {row.state}: {row.total}
            </li>
          ))}
        </ul>
      </section>
      {canPrepare && <PublicReportGenerator filters={filters} />}
    </>
  );
}
