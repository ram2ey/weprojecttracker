import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/security/staff-session";
import { Console } from "@/components/staff/console";
import { TeamForm } from "@/components/staff/team-form";
import { RecordCreator } from "@/components/content/record-creator";
import { RecordList } from "@/components/content/record-list";
import { TaxonomyManager } from "@/components/content/taxonomy-manager";
import { listAdminRecords, listTaxonomy } from "@/lib/content/service";
import { contentKinds, type ContentKind } from "@/lib/content/types";
import { getPool } from "@/db";
import { ModerationPanel } from "@/components/engagement/moderation-panel";
import { StaffInbox } from "@/components/engagement/staff-inbox";
import { ReportsPanel } from "@/components/reports/reports-panel";
import { reportFiltersSchema } from "@/lib/reports/data";
import { listModeration } from "@/lib/engagement/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const identity = await requireStaff();
  const params = await searchParams;
  const view = params.view ?? "overview";
  if (
    ["team", "taxonomy", "audit"].includes(view) &&
    identity.staff.role !== "super_admin"
  )
    redirect("/admin");
  if (view === "new" && identity.staff.role === "approver")
    redirect("/admin?view=review");
  let children: React.ReactNode;
  if (view === "new") children = <RecordCreator />;
  else if (view === "inbox") children = <StaffInbox />;
  else if (view === "engagement") {
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(params.page) || 1)),
    );
    const state = [
      "pending",
      "approved",
      "rejected",
      "resolved",
      "withdrawn",
      "all",
    ].includes(params.state || "")
      ? params.state!
      : "pending";
    const kind = [
      "all",
      "comment",
      "feedback",
      "correction",
      "report",
    ].includes(params.kind || "")
      ? params.kind!
      : "all";
    const listing = await listModeration(page, state, kind, params.submission);
    children = (
      <ModerationPanel
        {...listing}
        actorId={identity.user.id}
        role={identity.staff.role}
        state={state}
        kind={kind}
      />
    );
  } else if (view === "reports") {
    const parsed = reportFiltersSchema.safeParse(params);
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(params.page) || 1)),
    );
    children = parsed.success ? (
      <ReportsPanel
        filters={parsed.data}
        page={page}
        canPrepare={identity.staff.role !== "approver"}
      />
    ) : (
      <p className="form-error" role="alert">
        Please check the report filters.{" "}
        {parsed.error.issues.map((i) => i.message).join(" ")}
      </p>
    );
  } else if (view === "team")
    children = (
      <>
        <div className="console-heading">
          <div>
            <span className="eyebrow">OPERATOR CONTROLS</span>
            <h1>People behind the platform.</h1>
            <p>
              Staff setup and recovery links are generated here and shared
              personally.
            </p>
          </div>
        </div>
        <TeamForm preview={false} />
      </>
    );
  else if (view === "taxonomy")
    children = <TaxonomyManager terms={await listTaxonomy()} />;
  else if (view === "audit") {
    const events = await getPool().query<{
      id: string;
      action: string;
      subject_id: string | null;
      name: string;
      created_at: Date;
      details: Record<string, string> | null;
    }>(
      'SELECT a.id,a.action,a.subject_id,a.created_at,a.details,u.name FROM audit_log a LEFT JOIN "user" u ON a.actor_id=u.id ORDER BY a.created_at DESC LIMIT 100',
    );
    children = (
      <>
        <div className="console-heading">
          <div>
            <span className="eyebrow">OPERATOR OVERSIGHT</span>
            <h1>A record of decisions.</h1>
            <p>
              Latest 100 administrative actions. Published snapshots remain in
              each record&apos;s revision history.
            </p>
          </div>
        </div>
        <div className="table-panel">
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Audit trail table"
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
                {events.rows.map((event) => (
                  <tr key={event.id}>
                    <td>
                      {event.created_at.toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>{event.name ?? "System"}</td>
                    <td>{event.action}</td>
                    <td className="audit-details">
                      {event.details
                        ? Object.entries(event.details)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  } else {
    const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
    const kind = contentKinds.includes(params.kind as ContentKind)
      ? (params.kind as ContentKind)
      : undefined;
    const [listing, totals] = await Promise.all([
      listAdminRecords({ pending: view === "review", kind, page }),
      getPool().query<{
        total: number;
        pending: number;
        published: number;
        withdrawn: number;
      }>(
        `SELECT (SELECT count(*)::int FROM content_record) AS total, (SELECT count(*)::int FROM content_revision WHERE state='pending') AS pending, (SELECT count(*)::int FROM content_record WHERE published_revision_id IS NOT NULL AND withdrawn_at IS NULL) AS published, (SELECT count(*)::int FROM content_record WHERE withdrawn_at IS NOT NULL) AS withdrawn`,
      ),
    ]);
    children = (
      <RecordList
        {...listing}
        view={view}
        role={identity.staff.role}
        stats={totals.rows[0]}
      />
    );
  }
  return (
    <Console
      preview={false}
      view={view}
      name={identity.user.name}
      role={identity.staff.role}
      projects={[]}
    >
      {children}
    </Console>
  );
}
