import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/security/staff-session";
import { Console } from "@/components/staff/console";
import { TeamForm } from "@/components/staff/team-form";
import { RecordCreator } from "@/components/content/record-creator";
import { RecordList } from "@/components/content/record-list";
import { TaxonomyManager } from "@/components/content/taxonomy-manager";
import { listAdminRecords, listTaxonomy } from "@/lib/content/service";
import { getPool } from "@/db";
import { Analytics } from "@/components/staff/analytics";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const identity = await requireStaff(),
    params = await searchParams,
    view = params.view ?? "projects";
  if (
    ![
      "projects",
      "review",
      "new",
      "team",
      "taxonomy",
      "audit",
      "analytics",
    ].includes(view)
  )
    notFound();
  if (
    ["team", "taxonomy", "audit", "analytics"].includes(view) &&
    identity.staff.role !== "super_admin"
  )
    redirect("/admin");
  if (view === "new" && identity.staff.role === "approver")
    redirect("/admin?view=review");
  let children: React.ReactNode;
  if (view === "analytics")
    children = (
      <Analytics
        days={params.days === "7" ? 7 : params.days === "90" ? 90 : 30}
      />
    );
  else if (view === "team") children = <TeamForm />;
  else if (view === "taxonomy")
    children = <TaxonomyManager terms={await listTaxonomy()} />;
  else if (view === "new") children = <RecordCreator />;
  else if (view === "audit") {
    const events = await getPool().query<{
      id: string;
      action: string;
      subject_id: string;
      name: string;
      created_at: Date;
      details: Record<string, string> | null;
    }>(
      'SELECT a.id,a.action,a.subject_id,a.created_at,a.details,u.name FROM audit_log a LEFT JOIN "user" u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.id LIMIT 101 OFFSET $1',
      [(Math.max(1, Math.floor(Number(params.page) || 1)) - 1) * 100],
    );
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    children = (
      <>
        <h1>Audit log</h1>
        <div
          className="table-panel table-scroll"
          role="region"
          aria-label="Audit log"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Account</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.rows.slice(0, 100).map((e) => (
                <tr key={e.id}>
                  <td>{e.created_at.toISOString()}</td>
                  <td>{e.name ?? "System"}</td>
                  <td>{e.action}</td>
                  <td>
                    {Object.entries(e.details ?? {})
                      .map(([k, v]) => k + ": " + v)
                      .join(" · ") ||
                      e.subject_id ||
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className="pagination" aria-label="Audit pages">
          {page > 1 && (
            <a href={"/admin?view=audit&page=" + (page - 1)}>Previous</a>
          )}
          <span>Page {page}</span>
          {events.rows.length > 100 && (
            <a href={"/admin?view=audit&page=" + (page + 1)}>Next</a>
          )}
        </nav>
      </>
    );
  } else {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        q: z.string().trim().max(200).default(""),
      })
      .safeParse({ page: params.page, q: params.q });
    const filters = parsed.success ? parsed.data : { page: 1, q: "" };
    children = (
      <RecordList
        {...await listAdminRecords({ ...filters, pending: view === "review" })}
        q={filters.q}
        view={view}
        role={identity.staff.role}
      />
    );
  }
  return (
    <Console view={view} name={identity.user.name} role={identity.staff.role}>
      {children}
    </Console>
  );
}
