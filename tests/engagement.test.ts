import test from "node:test";
import assert from "node:assert/strict";
import {
  csvExport,
  excelExport,
  pdfExport,
  safeCsvCell,
} from "../src/lib/reports/exports";
import {
  allowedPushEndpoint,
  spamReason,
  submissionSchema,
} from "../src/lib/engagement/validation";
import { reportFiltersSchema, type ReportRow } from "../src/lib/reports/data";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
const row: ReportRow = {
  id: "test",
  code: "WE-P00001",
  slug: "test",
  title: '=HYPERLINK("https://example.invalid")',
  category: "Education",
  community: "Daboase",
  status: "Ongoing",
  progress: 45,
  workflow: "approved",
  published: true,
  withdrawn: false,
  updated: "2026-10-29T12:00:00.000Z",
  actualCompletionDate: "",
  overdue: false,
  budget: "12345.67",
  expenditure: "321.89",
  fundingSource: "Internal fund",
};
test("CSV neutralises spreadsheet formulas and preserves quoted multiline text", () => {
  for (const input of ["=1+1", " +CMD()", "@SUM(A1)", "\t=2", "-1+2"])
    assert.ok(safeCsvCell(input).startsWith("\"'"));
  assert.equal(safeCsvCell('A "quoted"\nname'), '"A ""quoted""\nname"');
  assert.ok(csvExport([row]).includes("'" + row.title.replaceAll('"', '""')));
});
test("Excel export reopens with literal formula-like names, typed amounts and dates", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(await excelExport([row])).buffer);
  const sheet = book.worksheets[0];
  assert.equal(sheet.getCell("B5").value, row.title);
  assert.equal(sheet.getCell("L5").value, 12345.67);
  assert.equal(sheet.getCell("M5").value, 321.89);
  assert.ok(sheet.getCell("I5").value instanceof Date);
  assert.equal(sheet.getCell("F5").value, 45);
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(sheet.rowCount, 5);
});
test("Unicode PDF report paginates long names and can be reopened", async () => {
  const bytes = await pdfExport(
    Array.from({ length: 22 }, (_, i) => ({
      ...row,
      title: `${i + 1}. Community progress — École Ɔman ${"long project name ".repeat(12)}`,
    })),
    { public: true, title: "Public progress summary" },
  );
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 3);
  assert.equal(document.getTitle(), "Public progress summary");
});
test("push endpoints cannot target local networks or arbitrary HTTPS hosts", () => {
  for (const endpoint of [
    "http://127.0.0.1/x",
    "https://127.0.0.1/x",
    "https://example.com/x",
    "https://fcm.googleapis.com.evil.invalid/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
  ])
    assert.equal(allowedPushEndpoint(endpoint), false);
  assert.equal(
    allowedPushEndpoint("https://fcm.googleapis.com/send/test"),
    true,
  );
  assert.equal(allowedPushEndpoint("https://web.push.apple.com/test"), true);
});
test("guest forms reject email fields, spam and invalid reporting date ranges", () => {
  assert.equal(
    submissionSchema.safeParse({ recordId: "fake", email: "a@example.com" })
      .success,
    false,
  );
  assert.equal(
    spamReason("https://a.invalid https://b.invalid https://c.invalid"),
    "too_many_links",
  );
  assert.equal(spamReason("a".repeat(20)), "repetitive_content");
  assert.equal(
    reportFiltersSchema.safeParse({ from: "2026-12-01", to: "2026-01-01" })
      .success,
    false,
  );
});
