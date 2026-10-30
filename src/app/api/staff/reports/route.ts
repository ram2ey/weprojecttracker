import { z } from "zod";
import { staffApi, jsonBody } from "@/lib/content/api";
import {
  reportData,
  publicReportData,
  reportFiltersSchema,
} from "@/lib/reports/data";
import { csvExport, excelExport, pdfExport } from "@/lib/reports/exports";
import {
  ContentError,
  createRecord,
  saveRevision,
} from "@/lib/content/service";
import { storeEvidence } from "@/lib/content/media";
import { emptyPayload, emptyFinancials } from "@/lib/content/types";
import { canSubmit } from "@/lib/security/policy";
import { getIdentity } from "@/lib/security/staff-session";
import { getPool } from "@/db";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (!format)
    return staffApi(request, async () => {
      const filters = reportFiltersSchema.parse(Object.fromEntries(params));
      const data = await reportData(filters);
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(params.get("page") ?? 1);
      return {
        ...data,
        rows: data.rows.slice((page - 1) * 25, page * 25),
        page,
      };
    });
  const identity = await getIdentity(request.headers);
  if (!identity?.verified)
    return Response.json(
      { message: "Verified staff access is required." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  let result: Response | undefined;
  const gate = await staffApi(request, async (actor) => {
    const type = z.enum(["csv", "xlsx", "pdf"]).parse(format),
      data = await reportData(
        reportFiltersSchema.parse(Object.fromEntries(params)),
      );
    const bytes =
      type === "csv"
        ? Buffer.from(csvExport(data.rows))
        : type === "xlsx"
          ? await excelExport(data.rows)
          : await pdfExport(data.rows, { public: false });
    await getPool().query(
      "INSERT INTO audit_log (id,actor_id,action,subject_id,details) VALUES ($1,$2,'reports.exported',$3,$4)",
      [
        crypto.randomUUID(),
        actor.id,
        "project-register",
        JSON.stringify({ format: type, count: String(data.total) }),
      ],
    );
    result = new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          type === "csv"
            ? "text/csv; charset=utf-8"
            : type === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf",
        "Content-Disposition": `attachment; filename="wassa-internal-projects.${type}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    return { exported: true };
  });
  return result || gate;
}
export function POST(request: Request) {
  return staffApi(request, async (actor) => {
    if (!canSubmit(actor.role))
      throw new ContentError(
        403,
        "An officer or operator must prepare a public report.",
      );
    const input = z
      .object({
        title: z.string().trim().min(3).max(160),
        reportingOffice: z.string().trim().min(3).max(300),
        filters: reportFiltersSchema,
      })
      .strict()
      .parse(await jsonBody(request));
    const rows = await publicReportData(input.filters);
    const pdf = await pdfExport(rows, {
      public: true,
      title: input.title,
      reportingOffice: input.reportingOffice,
    });
    const draft = await createRecord(actor, "report", input.title);
    for (const row of rows)
      await getPool().query(
        "INSERT INTO report_source (id,report_record_id,source_record_id,source_revision_id) VALUES ($1,$2,$3,$4)",
        [
          crypto.randomUUID(),
          draft.recordId,
          row.sourceRecordId,
          row.sourceRevisionId,
        ],
      );
    const file = await storeEvidence(
      actor,
      draft.recordId,
      new File([new Uint8Array(pdf)], "public-project-report.pdf", {
        type: "application/pdf",
      }),
      false,
    );
    await saveRevision(actor, draft.recordId, draft.revisionId, {
      lockVersion: 0,
      financials: emptyFinancials,
      payload: {
        ...emptyPayload,
        title: input.title,
        description: `Summary of ${rows.length} independently approved project records, prepared for review on ${new Date().toISOString().slice(0, 10)}.`,
        source: "Approved public project register",
        reportingOffice: input.reportingOffice,
        attachments: [
          {
            id: file.id,
            caption: input.title,
            capturedOn: new Date().toISOString().slice(0, 10),
            visibility: "public",
            purpose: "evidence",
          },
        ],
      },
    });
    return {
      ...draft,
      message:
        "Private public-report draft created. Review its PDF, then submit it for independent approval.",
    };
  });
}
