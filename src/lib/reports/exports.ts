import ExcelJS from "exceljs";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReportRow, PublicReportRow } from "./data";
export const columns = [
  "Record",
  "Title",
  "Category",
  "Community",
  "Status",
  "Progress (%)",
  "Workflow",
  "Publication",
  "Last changed (UTC)",
  "Actual completion",
  "Overdue update",
  "Budget (GHS, internal)",
  "Expenditure (GHS, internal)",
  "Funding source (internal)",
];
export function exportCells(row: ReportRow) {
  return [
    row.code,
    row.title,
    row.category,
    row.community,
    row.status,
    row.progress,
    row.workflow,
    row.withdrawn ? "Withdrawn" : row.published ? "Published" : "Private",
    row.updated,
    row.actualCompletionDate,
    row.overdue ? "Yes" : "No",
    row.budget,
    row.expenditure,
    row.fundingSource,
  ];
}
export function safeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function csvExport(rows: ReportRow[]) {
  return (
    "\uFEFF" +
    [columns, ...rows.map(exportCells)]
      .map((r) => r.map(safeCsvCell).join(","))
      .join("\r\n")
  );
}
export async function excelExport(rows: ReportRow[]) {
  const book = new ExcelJS.Workbook();
  book.creator = "Wassa East Projects";
  book.created = new Date();
  const sheet = book.addWorksheet("Project register", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.addRow(["Wassa East · Internal project register"]);
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getRow(1).font = {
    name: "Aptos",
    size: 18,
    bold: true,
    color: { argb: "FF214E3B" },
  };
  sheet.addRow([
    `Internal staff use · Generated ${new Date().toISOString()} · Source: constituency project register`,
  ]);
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getRow(2).font = {
    name: "Aptos",
    size: 10,
    color: { argb: "FF6A5741" },
  };
  sheet.addRow([]);
  sheet.addRow(columns);
  sheet.getRow(4).font = {
    name: "Aptos",
    bold: true,
    size: 11,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(4).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF214E3B" },
  };
  sheet.getRow(4).height = 34;
  for (const r of rows) {
    const row = sheet.addRow(exportCells(r));
    for (const [index, value] of [
      [12, r.budget],
      [13, r.expenditure],
    ] as const) {
      if (
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Math.abs(Number(value)) < 1e15
      )
        row.getCell(index).value = Number(value);
    }
    row.getCell(9).value = new Date(r.updated);
    if (r.actualCompletionDate)
      row.getCell(10).value = new Date(`${r.actualCompletionDate}T00:00:00Z`);
    row.font = { name: "Aptos", size: 11, color: { argb: "FF263C32" } };
    row.alignment = { vertical: "top", wrapText: true };
    row.height = Math.min(90, 30 + Math.floor(r.title.length / 45) * 15);
  }
  [17, 48, 25, 27, 18, 15, 16, 16, 27, 20, 17, 24, 27, 34].forEach(
    (width, i) => (sheet.getColumn(i + 1).width = width),
  );
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, sheet.rowCount), column: columns.length },
  };
  sheet.getColumn(6).numFmt = '0"%"';
  sheet.getColumn(9).numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn(10).numFmt = "yyyy-mm-dd";
  sheet.getColumn(12).numFmt = '"GHS "#,##0.00';
  sheet.getColumn(13).numFmt = '"GHS "#,##0.00';
  sheet.pageSetup.printTitlesRow = "4:4";
  return Buffer.from(await book.xlsx.writeBuffer());
}
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let part = "";
        for (const char of rest) {
          if (font.widthOfTextAtSize(part + char, size) > width) break;
          part += char;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(part || rest[0]);
        rest = rest.slice((part || rest[0]).length);
      }
      const next = line ? line + " " + rest : rest;
      if (font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = rest;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
export async function pdfExport(
  rows: (ReportRow | PublicReportRow)[],
  options: { public: boolean; title?: string; reportingOffice?: string },
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await readFile(
    join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
  );
  const font = await doc.embedFont(bytes, { subset: true });
  doc.setTitle(options.title || "Wassa East project register");
  doc.setAuthor("Wassa East Projects");
  let page: PDFPage,
    y = 0;
  const margin = 42,
    width = 511;
  const pages: PDFPage[] = [];
  function newPage() {
    page = doc.addPage([595.28, 841.89]);
    pages.push(page);
    page.drawRectangle({
      x: 0,
      y: 830,
      width: 596,
      height: 12,
      color: rgb(0.13, 0.31, 0.23),
    });
    page.drawText("WASSA EAST PROJECTS", {
      x: margin,
      y: 794,
      size: 10,
      font,
      color: rgb(0.13, 0.31, 0.23),
    });
    page.drawText(
      options.public
        ? "PUBLIC PROJECT SUMMARY · APPROVED DATA SNAPSHOT"
        : "INTERNAL STAFF REPORT · DO NOT PUBLISH",
      { x: margin, y: 773, size: 8, font, color: rgb(0.48, 0.26, 0.16) },
    );
    y = 741;
  }
  function text(value: string, size = 10, gap = 5) {
    for (const line of wrap(value, font, size, width)) {
      if (y < 62) newPage();
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0.15, 0.23, 0.18),
      });
      y -= size + gap;
    }
  }
  newPage();
  text(options.title || "Project register", 22, 9);
  text(
    `Generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
    9,
  );
  if (options.reportingOffice)
    text(`Reporting office: ${options.reportingOffice}`, 10);
  text(
    `${rows.length} project records · Source: ${options.public ? "current independently approved public snapshots" : "latest internal project revisions"}`,
    10,
  );
  y -= 14;
  for (const [index, r] of rows.entries()) {
    if (y < 160) newPage();
    text(`${index + 1}. ${r.title}`, 13, 7);
    text(
      `${r.code} · ${r.category || "Unassigned category"} · ${r.community || "Unassigned community"}`,
    );
    text(`Status: ${r.status} · Reported progress: ${r.progress}%`);
    text(
      `Last ${options.public ? "approved" : "changed"}: ${r.updated.slice(0, 10)} · Completion: ${r.actualCompletionDate || "Not reported"}`,
    );
    if (!options.public && "budget" in r) {
      text(
        `Workflow: ${r.workflow} · ${r.withdrawn ? "Withdrawn" : r.published ? "Published" : "Private"} · Overdue update: ${r.overdue ? "Yes" : "No"}`,
      );
      text(
        `Budget (GHS): ${r.budget || "Not supplied"} · Expenditure (GHS): ${r.expenditure || "Not supplied"}`,
      );
      text(`Funding source (internal): ${r.fundingSource || "Not supplied"}`);
    }
    y -= 15;
  }
  if (!rows.length) text("No project records matched the selected filters.");
  for (const [i, p] of pages.entries())
    p.drawText(`Wassa East Projects · ${i + 1} / ${pages.length}`, {
      x: margin,
      y: 30,
      size: 8,
      font,
      color: rgb(0.35, 0.41, 0.35),
    });
  return Buffer.from(await doc.save());
}
