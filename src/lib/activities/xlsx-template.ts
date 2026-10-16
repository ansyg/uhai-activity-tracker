import "server-only";
import ExcelJS from "exceljs";
import {
  IMPORT_COLUMNS,
  ACTIVITIES_SHEET_NAME,
  REFERENCE_SHEET_NAME,
  INSTRUCTIONS_SHEET_NAME,
  TEMPLATE_INSTRUCTIONS,
} from "./import-columns";

export interface TemplateContext {
  trackerName: string;
  phases: { name: string }[];
  modules: { name: string; systemName: string }[];
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6F50" } };

export async function buildActivityImportTemplate(ctx: TemplateContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UHAI Activity Tracker";
  workbook.created = new Date();

  // --- Instructions ---
  const instructions = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  instructions.columns = [{ width: 100 }];
  instructions.addRow([`Import activities into: ${ctx.trackerName}`]).font = { bold: true, size: 14 };
  instructions.addRow([]);
  TEMPLATE_INSTRUCTIONS.forEach((line, i) => {
    const row = instructions.addRow([`${i + 1}. ${line}`]);
    row.alignment = { wrapText: true, vertical: "top" };
  });
  instructions.getColumn(1).width = 100;

  // --- Reference: valid phase names and module codes, so a user doesn't have to guess ---
  const reference = workbook.addWorksheet(REFERENCE_SHEET_NAME);
  reference.columns = [
    { header: "Valid phase names", key: "phase", width: 32 },
    { header: "Valid module codes (system)", key: "module", width: 32 },
  ];
  reference.getRow(1).font = { bold: true };
  reference.getRow(1).fill = HEADER_FILL;
  reference.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  const maxRows = Math.max(ctx.phases.length, ctx.modules.length, 1);
  for (let i = 0; i < maxRows; i++) {
    reference.addRow({
      phase: ctx.phases[i]?.name ?? "",
      module: ctx.modules[i] ? `${ctx.modules[i].name} (${ctx.modules[i].systemName})` : "",
    });
  }

  // --- Activities: the actual data-entry sheet ---
  const sheet = workbook.addWorksheet(ACTIVITIES_SHEET_NAME);
  sheet.columns = IMPORT_COLUMNS.map((col) => ({ header: col.header, key: col.field, width: col.width }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = HEADER_FILL;
  headerRow.eachCell((cell) => {
    cell.alignment = { wrapText: true, vertical: "middle" };
  });

  const exampleRow = sheet.addRow(
    Object.fromEntries(IMPORT_COLUMNS.map((col) => [col.field, col.field === "title" ? `EXAMPLE — ${col.example || "delete this row"}` : col.example]))
  );
  exampleRow.font = { italic: true, color: { argb: "FF93A399" } };

  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(written as ArrayBuffer);
}
