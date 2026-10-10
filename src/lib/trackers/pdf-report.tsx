import PDFDocument from "pdfkit";
import { BRAND } from "@/lib/branding";
import type { TrackerReportData } from "./report-data";

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 in points
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = "#13201b";
const MUTED = "#5e685f";
const PRIMARY = "#16563d";
const BORDER = "#cfcfc7";
const HEADER_BG = "#eef0e9";

function formatDate(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "—";
}

interface Column {
  label: string;
  width: number;
  get: (row: Record<string, unknown>) => string;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawTable(doc: PDFKit.PDFDocument, columns: Column[], rows: Record<string, unknown>[]) {
  const rowHeight = 16;
  const startX = doc.x;

  function drawHeader() {
    ensureSpace(doc, rowHeight * 2);
    const y = doc.y;
    doc.rect(startX, y, CONTENT_WIDTH, rowHeight).fill(HEADER_BG);
    doc.fillColor(INK).fontSize(8.5).font("Helvetica-Bold");
    let x = startX;
    for (const col of columns) {
      doc.text(col.label, x + 4, y + 4, { width: col.width - 8, lineBreak: false });
      x += col.width;
    }
    doc.y = y + rowHeight;
  }

  drawHeader();

  doc.font("Helvetica").fontSize(8.5).fillColor(INK);
  for (const row of rows) {
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    let x = startX;
    for (const col of columns) {
      doc.text(col.get(row), x + 4, y + 4, { width: col.width - 8, height: rowHeight, ellipsis: true, lineBreak: false });
      x += col.width;
    }
    doc.moveTo(startX, y + rowHeight).lineTo(startX + CONTENT_WIDTH, y + rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.y = y + rowHeight;
  }
  doc.moveDown(0.6);
}

export async function renderTrackerReportPdf(data: TrackerReportData): Promise<Buffer> {
  const { tracker, dashboard, phases } = data;
  const completionPercent = dashboard.totals.total
    ? Math.round((dashboard.totals.completed / dashboard.totals.total) * 100)
    : 0;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(9).text(BRAND.name.toUpperCase(), { characterSpacing: 1 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(tracker.name, { paragraphGap: 2 });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(`Progress report generated ${new Date().toISOString().slice(0, 10)}`);

  if (tracker.description) {
    doc.moveDown(0.6);
    doc.fillColor(INK).fontSize(10).text(tracker.description, { width: CONTENT_WIDTH });
  }

  doc.moveDown(1);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("Summary");
  doc.moveDown(0.3);

  const summaryRows: [string, string][] = [
    ["Overall completion", `${completionPercent}%`],
    ["Total activities", String(dashboard.totals.total)],
    ["Completed", String(dashboard.totals.completed)],
    ["In progress", String(dashboard.totals.inProgress)],
    ["Not started", String(dashboard.totals.notStarted)],
    ["Overdue", String(dashboard.overdue)],
  ];
  doc.font("Helvetica").fontSize(9.5);
  for (const [label, value] of summaryRows) {
    const y = doc.y;
    doc.fillColor(MUTED).text(label, MARGIN, y, { continued: false, width: 180 });
    doc.fillColor(INK).font("Helvetica-Bold").text(value, MARGIN + 180, y);
    doc.font("Helvetica");
  }

  doc.moveDown(1);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("Progress by phase");
  doc.moveDown(0.3);
  drawTable(
    doc,
    [
      { label: "Phase", width: CONTENT_WIDTH * 0.52, get: (r) => String(r.name) },
      { label: "Done", width: CONTENT_WIDTH * 0.14, get: (r) => String(r.completed) },
      { label: "Total", width: CONTENT_WIDTH * 0.14, get: (r) => String(r.total) },
      { label: "%", width: CONTENT_WIDTH * 0.2, get: (r) => `${r.avgPercent}%` },
    ],
    dashboard.byPhase as unknown as Record<string, unknown>[]
  );

  doc.addPage();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("Activities");
  doc.moveDown(0.4);

  for (const phase of phases) {
    ensureSpace(doc, 40);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5).text(phase.name);
    doc.moveDown(0.2);

    const activityRows = phase.activities.map((activity) => ({
      title: activity.title,
      assignees: activity.assignees.map((a) => a.user?.name ?? a.roleTag).join(", ") || "—",
      start: formatDate(activity.startDate),
      end: formatDate(activity.endDate),
      percent: `${activity.statusPercent}%`,
      status: activity.status.replace("_", " "),
    }));

    drawTable(
      doc,
      [
        { label: "Activity", width: CONTENT_WIDTH * 0.3, get: (r) => String(r.title) },
        { label: "Assignees", width: CONTENT_WIDTH * 0.26, get: (r) => String(r.assignees) },
        { label: "Start", width: CONTENT_WIDTH * 0.13, get: (r) => String(r.start) },
        { label: "End", width: CONTENT_WIDTH * 0.13, get: (r) => String(r.end) },
        { label: "%", width: CONTENT_WIDTH * 0.08, get: (r) => String(r.percent) },
        { label: "Status", width: CONTENT_WIDTH * 0.1, get: (r) => String(r.status) },
      ],
      activityRows
    );
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(`${BRAND.company} · ${BRAND.address} · ${BRAND.email}`, MARGIN, doc.page.height - 30, {
        width: CONTENT_WIDTH,
        align: "center",
      });
  }

  doc.end();
  return done;
}
