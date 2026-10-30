import { z } from "zod";
import { getPool } from "@/db";
import { ContentError } from "@/lib/content/service";
import type { ContentPayload, Financials } from "@/lib/content/types";
const optional = (max: number) =>
  z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const date = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.iso.date().optional(),
);
export const reportFiltersSchema = z
  .object({
    q: optional(200),
    category: optional(120),
    community: optional(120),
    status: optional(40),
    workflow: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .enum(["draft", "pending", "returned", "rejected", "approved"])
        .optional(),
    ),
    from: date,
    to: date,
    completedFrom: date,
    completedTo: date,
    overdue: z
      .preprocess((v) => v === "true" || v === true, z.boolean())
      .default(false),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Invalid update date range.",
  })
  .refine(
    (v) =>
      !v.completedFrom || !v.completedTo || v.completedFrom <= v.completedTo,
    { message: "Invalid completion date range." },
  );
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportRow = {
  id: string;
  code: string;
  slug: string;
  title: string;
  category: string;
  community: string;
  status: string;
  progress: number;
  workflow: string;
  published: boolean;
  withdrawn: boolean;
  updated: string;
  actualCompletionDate: string;
  overdue: boolean;
  budget: string;
  expenditure: string;
  fundingSource: string;
};
export type PublicReportRow = Pick<
  ReportRow,
  | "code"
  | "title"
  | "category"
  | "community"
  | "status"
  | "progress"
  | "actualCompletionDate"
  | "updated"
> & { sourceRecordId: string; sourceRevisionId: string };
function reportWhere(filters: ReportFilters, publicOnly = false) {
  const values: string[] = [];
  const clauses: string[] = [];
  const add = (expression: string, value: string | undefined) => {
    if (value) {
      values.push(value);
      clauses.push(expression.replaceAll("?", `$${values.length}::text`));
    }
  };
  add(
    "position(lower(?) in lower(concat_ws(' ',v.payload->>'title','WE-P'||lpad(r.number::text,5,'0'),v.payload->>'communityName')))>0",
    filters.q,
  );
  add("v.payload->>'categoryName'=?", filters.category);
  add("v.payload->>'communityName'=?", filters.community);
  add("v.payload->>'status'=?", filters.status);
  if (!publicOnly) add("v.state=?", filters.workflow);
  const updated = publicOnly ? "v.decided_at" : "v.updated_at";
  add(`to_char(${updated} AT TIME ZONE 'UTC','YYYY-MM-DD')>=?`, filters.from);
  add(`to_char(${updated} AT TIME ZONE 'UTC','YYYY-MM-DD')<=?`, filters.to);
  add(
    "nullif(v.payload->>'actualCompletionDate','')>=?",
    filters.completedFrom,
  );
  add("nullif(v.payload->>'actualCompletionDate','')<=?", filters.completedTo);
  if (filters.overdue && !publicOnly)
    clauses.push(
      "r.withdrawn_at IS NULL AND r.reminder_days>0 AND p.payload->>'status' IN ('Ongoing','Delayed') AND p.decided_at<NOW()-r.reminder_days*INTERVAL '1 day'",
    );
  return {
    sql: clauses.length ? clauses.map((c) => `(${c})`).join(" AND ") : "true",
    values,
  };
}
export async function reportData(filters: ReportFilters) {
  const where = reportWhere(filters);
  const result = await getPool().query<{
    id: string;
    number: number;
    slug: string;
    payload: ContentPayload;
    financials: Financials;
    state: string;
    updated_at: Date;
    published_revision_id: string | null;
    withdrawn_at: Date | null;
    overdue: boolean;
  }>(
    `SELECT r.id,r.number,r.slug,v.payload,v.financials,v.state,v.updated_at,r.published_revision_id,r.withdrawn_at,coalesce(r.withdrawn_at IS NULL AND r.reminder_days>0 AND p.payload->>'status' IN ('Ongoing','Delayed') AND p.decided_at<NOW()-r.reminder_days*INTERVAL '1 day',false) AS overdue FROM content_record r JOIN LATERAL (SELECT * FROM content_revision c WHERE c.record_id=r.id ORDER BY c.number DESC LIMIT 1) v ON true LEFT JOIN content_revision p ON p.id=r.published_revision_id AND p.record_id=r.id WHERE r.kind='project' AND ${where.sql} ORDER BY v.updated_at DESC,r.id LIMIT 5001`,
    where.values,
  );
  if (result.rows.length > 5000)
    throw new ContentError(
      413,
      "This report exceeds 5,000 records. Narrow the register before exporting.",
    );
  const rows: ReportRow[] = result.rows
    .map((r) => ({
      id: r.id,
      code: `WE-P${String(r.number).padStart(5, "0")}`,
      slug: r.slug,
      title: r.payload.title,
      category: r.payload.categoryName,
      community: r.payload.communityName,
      status: r.payload.status,
      progress: r.payload.progress,
      workflow: r.state,
      published: !!r.published_revision_id && !r.withdrawn_at,
      withdrawn: !!r.withdrawn_at,
      updated: r.updated_at.toISOString(),
      actualCompletionDate: r.payload.actualCompletionDate,
      overdue: r.overdue,
      budget: r.financials.budget,
      expenditure: r.financials.expenditure,
      fundingSource: r.financials.fundingSource,
    }))
    .filter(
      (r) =>
        (!filters.q ||
          `${r.title} ${r.code} ${r.community}`
            .toLowerCase()
            .includes(filters.q.toLowerCase())) &&
        (!filters.category || r.category === filters.category) &&
        (!filters.community || r.community === filters.community) &&
        (!filters.status || r.status === filters.status) &&
        (!filters.workflow || r.workflow === filters.workflow) &&
        (!filters.from || r.updated.slice(0, 10) >= filters.from) &&
        (!filters.to || r.updated.slice(0, 10) <= filters.to) &&
        (!filters.completedFrom ||
          (!!r.actualCompletionDate &&
            r.actualCompletionDate >= filters.completedFrom)) &&
        (!filters.completedTo ||
          (!!r.actualCompletionDate &&
            r.actualCompletionDate <= filters.completedTo)) &&
        (!filters.overdue || r.overdue),
    );
  const [counts, feedback, failed] = await Promise.all([
    getPool().query<{ pending: number; published: number }>(
      "SELECT (SELECT count(*)::int FROM content_revision WHERE state='pending') AS pending,(SELECT count(*)::int FROM content_record WHERE published_revision_id IS NOT NULL AND withdrawn_at IS NULL) AS published",
    ),
    getPool().query<{ kind: string; state: string; total: number }>(
      "SELECT kind,state,count(*)::int AS total FROM guest_submission GROUP BY kind,state",
    ),
    getPool().query<{ total: number }>(
      "SELECT count(*)::int AS total FROM push_job WHERE state='failed'",
    ),
  ]);
  const group = (key: "category" | "community" | "status") =>
    Object.entries(
      rows.reduce(
        (acc, r) => {
          const value = r[key] || "Unassigned";
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).sort(([a], [b]) => a.localeCompare(b));
  return {
    rows,
    total: rows.length,
    summary: {
      pendingReviews: counts.rows[0].pending,
      publishedRecords: counts.rows[0].published,
      overdueProjects: rows.filter((r) => r.overdue).length,
      completedProjects: rows.filter((r) => r.status === "Completed").length,
      categories: group("category"),
      communities: group("community"),
      statuses: group("status"),
      completionPeriods: Object.entries(
        rows
          .filter((r) => r.actualCompletionDate)
          .reduce(
            (a, r) => {
              const month = r.actualCompletionDate.slice(0, 7);
              a[month] = (a[month] || 0) + 1;
              return a;
            },
            {} as Record<string, number>,
          ),
      ).sort(([a], [b]) => a.localeCompare(b)),
      feedback: feedback.rows,
      failedPushJobs: failed.rows[0].total,
    },
  };
}
export async function publicReportData(
  filters: ReportFilters,
): Promise<PublicReportRow[]> {
  const where = reportWhere(filters, true);
  // Separate SQL projection: never read internal financials for a public export.
  const result = await getPool().query<{
    id: string;
    revision_id: string;
    number: number;
    title: string;
    category: string;
    community: string;
    status: string;
    progress: number;
    actual_completion_date: string;
    published_at: Date;
  }>(
    `SELECT r.id,v.id AS revision_id,r.number,v.payload->>'title' AS title,v.payload->>'categoryName' AS category,v.payload->>'communityName' AS community,v.payload->>'status' AS status,(v.payload->>'progress')::int AS progress,v.payload->>'actualCompletionDate' AS actual_completion_date,v.decided_at AS published_at FROM content_record r JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id WHERE r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' AND ${where.sql} ORDER BY r.number LIMIT 5001`,
    where.values,
  );
  if (result.rows.length > 5000)
    throw new ContentError(413, "The public report exceeds 5,000 projects.");
  return result.rows
    .map((r) => ({
      sourceRecordId: r.id,
      sourceRevisionId: r.revision_id,
      code: `WE-P${String(r.number).padStart(5, "0")}`,
      title: r.title,
      category: r.category,
      community: r.community,
      status: r.status,
      progress: r.progress,
      actualCompletionDate: r.actual_completion_date,
      updated: r.published_at.toISOString(),
    }))
    .filter(
      (r) =>
        (!filters.q ||
          `${r.title} ${r.code} ${r.community}`
            .toLowerCase()
            .includes(filters.q.toLowerCase())) &&
        (!filters.category || r.category === filters.category) &&
        (!filters.community || r.community === filters.community) &&
        (!filters.status || r.status === filters.status) &&
        (!filters.from || r.updated.slice(0, 10) >= filters.from) &&
        (!filters.to || r.updated.slice(0, 10) <= filters.to) &&
        (!filters.completedFrom ||
          (!!r.actualCompletionDate &&
            r.actualCompletionDate >= filters.completedFrom)) &&
        (!filters.completedTo ||
          (!!r.actualCompletionDate &&
            r.actualCompletionDate <= filters.completedTo)),
    );
}
