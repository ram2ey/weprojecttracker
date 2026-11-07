import Link from "next/link";
import { getPool } from "@/db";

export async function Analytics({ days }: { days: 7 | 30 | 90 }) {
  const db = getPool();
  await db.query(
    "DELETE FROM analytics_daily WHERE day < (NOW() AT TIME ZONE 'UTC')::date - 89",
  );
  const [popular, daily] = await Promise.all([
    db.query<{ path: string; views: number }>(
      "SELECT path,sum(views)::int AS views FROM analytics_daily WHERE day >= (NOW() AT TIME ZONE 'UTC')::date - ($1::int-1) GROUP BY path ORDER BY views DESC,path LIMIT 20",
      [days],
    ),
    db.query<{ day: string; views: number }>(
      "SELECT to_char(day,'YYYY-MM-DD') AS day,sum(views)::int AS views FROM analytics_daily WHERE day >= (NOW() AT TIME ZONE 'UTC')::date - ($1::int-1) GROUP BY day ORDER BY day DESC",
      [days],
    ),
  ]);
  const total = daily.rows.reduce((sum, row) => sum + row.views, 0);
  return (
    <>
      <h1>Website statistics</h1>
      <p>
        Consenting public page views only. These are approximate page counts,
        not unique visitors; reloads and automated requests can affect totals.
        Staff sessions are excluded.
      </p>
      <nav className="action-row" aria-label="Statistics period">
        {([7, 30, 90] as const).map((n) => (
          <Link
            key={n}
            href={`/admin?view=analytics&days=${n}`}
            className="text-link"
            aria-current={days === n ? "page" : undefined}
          >
            Last {n} days
          </Link>
        ))}
      </nav>
      <section className="detail-section">
        <h2>{total.toLocaleString("en-GB")} page views</h2>
        <p>
          Last {days} days, including today. Dates use UTC. Daily aggregates
          expire after 90 days; expired rows are removed on the next collection
          or dashboard visit.
        </p>
      </section>
      {!daily.rows.length ? (
        <p>No consenting page views recorded for this period yet.</p>
      ) : (
        <>
          <div
            className="table-panel table-scroll"
            role="region"
            aria-label="Popular pages"
            tabIndex={0}
          >
            <table>
              <caption>Most viewed pages</caption>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {popular.rows.map((row) => (
                  <tr key={row.path}>
                    <td>
                      <Link href={row.path}>{row.path}</Link>
                    </td>
                    <td>{row.views.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="table-panel table-scroll"
            role="region"
            aria-label="Daily page views"
            tabIndex={0}
          >
            <table>
              <caption>Daily page views (UTC)</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {daily.rows.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td>{row.views.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
