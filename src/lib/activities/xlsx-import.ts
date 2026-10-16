import "server-only";
import ExcelJS from "exceljs";
import { IMPORT_COLUMNS, ACTIVITIES_SHEET_NAME, type ImportColumn } from "./import-columns";
import { DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/dates";

export interface ValidImportRow {
  rowNumber: number;
  /** Lowercased, trimmed — the caller resolves this to a real phaseId after
   * creating any phase in `newPhaseNames` that doesn't exist yet. */
  phaseKey: string;
  title: string;
  moduleId: string | null;
  roleTags: string[];
  startDate: string | null; // ISO
  endDate: string | null; // ISO
  statusPercent: number;
  description: string | null;
}

export interface InvalidImportRow {
  rowNumber: number;
  title: string | null;
  errors: string[];
}

export interface ImportParseResult {
  valid: ValidImportRow[];
  invalid: InvalidImportRow[];
  /** Distinct phase names referenced that don't exist on this tracker yet,
   * original casing preserved, in first-seen order — a brand new tracker
   * with no phases yet can still be bootstrapped entirely from one sheet. */
  newPhaseNames: string[];
}

const MAX_NEW_PHASES = 50;

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v.richText as { text: string }[]).map((t) => t.text).join("");
  }
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Accepts either a real Excel date cell or a typed "YYYY-MM-DD" string — the template asks for the latter, but Excel auto-formats some pasted input as a date cell regardless. */
function parseDateCell(cell: ExcelJS.Cell, label: string, errors: string[]): string | null {
  const raw = cell.value;
  if (raw === null || raw === undefined || raw === "") return null;

  let date: Date;
  if (raw instanceof Date) {
    date = raw;
  } else {
    const text = cellText(cell);
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      errors.push(`${label}: "${text}" isn't in YYYY-MM-DD format.`);
      return null;
    }
    date = new Date(`${text}T00:00:00.000Z`);
  }

  if (Number.isNaN(date.getTime())) {
    errors.push(`${label}: not a valid date.`);
    return null;
  }
  const iso = date.toISOString();
  if (iso.slice(0, 10) < DATE_INPUT_MIN || iso.slice(0, 10) > DATE_INPUT_MAX) {
    errors.push(`${label}: date must be between ${DATE_INPUT_MIN} and ${DATE_INPUT_MAX}.`);
    return null;
  }
  return iso;
}

export async function parseActivityImportFile(
  buffer: Buffer,
  context: {
    phases: { id: string; name: string }[];
    modules: { id: string; name: string }[];
  }
): Promise<ImportParseResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types declare their own Buffer, which this project's
  // newer @types/node resolves as a distinct (but runtime-identical) type —
  // a type-level clash only, not a real bug.
  // @ts-expect-error — Buffer vs exceljs's own Buffer type, see comment above
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(ACTIVITIES_SHEET_NAME);
  if (!sheet) {
    throw new Error(`This file doesn't have an "${ACTIVITIES_SHEET_NAME}" sheet — upload the unmodified template.`);
  }

  // Map by header TEXT, not fixed column position, in case a user reordered
  // (but didn't rename) columns — more forgiving without weakening validation.
  const headerRow = sheet.getRow(1);
  const columnByIndex = new Map<number, ImportColumn>();
  headerRow.eachCell((cell, colNumber) => {
    const text = cellText(cell);
    const match = IMPORT_COLUMNS.find((c) => c.header.toLowerCase() === text.toLowerCase());
    if (match) columnByIndex.set(colNumber, match);
  });
  const missingRequired = IMPORT_COLUMNS.filter((c) => c.required && ![...columnByIndex.values()].includes(c));
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required column${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.map((c) => c.header).join(", ")}. Upload the unmodified template.`
    );
  }

  const existingPhaseKeys = new Set(context.phases.map((p) => p.name.trim().toLowerCase()));
  const moduleByName = new Map(context.modules.map((m) => [m.name.trim().toLowerCase(), m]));

  const valid: ValidImportRow[] = [];
  const invalid: InvalidImportRow[] = [];
  const newPhaseNames: string[] = []; // original casing, first-seen order
  const seenNewPhaseKeys = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const raw: Record<string, ExcelJS.Cell> = {};
    columnByIndex.forEach((col, colNumber) => {
      raw[col.field] = row.getCell(colNumber);
    });

    const isBlankRow = Object.values(raw).every((cell) => cellText(cell) === "");
    if (isBlankRow) return;

    // The template's own example row is real-looking data (so it's
    // legible), not blank — skip it explicitly rather than relying on
    // every user to delete it before uploading, especially now that an
    // unrecognized phase name gets created instead of rejected.
    const titleText = raw.title ? cellText(raw.title) : "";
    if (titleText.toLowerCase().startsWith("example —") || titleText.toLowerCase().startsWith("example -")) return;

    const errors: string[] = [];

    const phaseNameText = raw.phaseName ? cellText(raw.phaseName) : "";
    const phaseKey = phaseNameText.toLowerCase();
    if (!phaseNameText) {
      errors.push("Phase is required.");
    } else if (!existingPhaseKeys.has(phaseKey) && !seenNewPhaseKeys.has(phaseKey)) {
      // Unrecognized phase name — not an error. It gets created, so a brand
      // new tracker with zero phases can be filled in entirely from this
      // sheet. Capped so a sheet full of typos doesn't silently spawn dozens
      // of near-duplicate phases.
      if (newPhaseNames.length >= MAX_NEW_PHASES) {
        errors.push(`Phase "${phaseNameText}" would be a new phase, but this import already creates ${MAX_NEW_PHASES} — add it on the tracker first.`);
      } else {
        seenNewPhaseKeys.add(phaseKey);
        newPhaseNames.push(phaseNameText);
      }
    }

    const title = titleText;
    if (!title) errors.push("Activity is required.");
    else if (title.length > 500) errors.push("Activity is too long (max 500 characters).");

    let moduleId: string | null = null;
    const moduleNameText = raw.moduleName ? cellText(raw.moduleName) : "";
    if (moduleNameText) {
      // Allow either the bare module code or the "Code (System)" form the Reference sheet shows.
      const bareName = moduleNameText.split("(")[0].trim().toLowerCase();
      const module_ = moduleByName.get(moduleNameText.toLowerCase()) ?? moduleByName.get(bareName);
      if (!module_) errors.push(`Module "${moduleNameText}" doesn't match any module linked to this tracker.`);
      else moduleId = module_.id;
    }

    const roleTags = raw.assignees
      ? cellText(raw.assignees)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const startDate = raw.startDate ? parseDateCell(raw.startDate, "Start date", errors) : null;
    const endDate = raw.endDate ? parseDateCell(raw.endDate, "End date", errors) : null;
    if (startDate && endDate && startDate > endDate) errors.push("Start date is after end date.");

    let statusPercent = 0;
    const percentText = raw.statusPercent ? cellText(raw.statusPercent) : "";
    if (percentText) {
      const n = Number(percentText);
      if (!Number.isInteger(n) || n < 0 || n > 100) errors.push("Progress % must be a whole number from 0 to 100.");
      else statusPercent = n;
    }

    const description = raw.description ? cellText(raw.description) : "";
    if (description.length > 4000) errors.push("Notes are too long (max 4000 characters).");

    if (errors.length > 0) {
      invalid.push({ rowNumber, title: title || null, errors });
      return;
    }

    valid.push({
      rowNumber,
      phaseKey,
      title,
      moduleId,
      roleTags,
      startDate,
      endDate,
      statusPercent,
      description: description || null,
    });
  });

  return { valid, invalid, newPhaseNames };
}
