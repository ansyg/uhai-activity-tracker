/**
 * The single source of truth for the Activities import sheet — both the
 * downloadable template and the upload parser read from this list, so the
 * two can never drift apart. Headers are deliberately plain, human phrasing
 * ("Progress % (0-100)") rather than the actual Prisma field names
 * (statusPercent, phaseId, moduleId) — the sheet a user fills in and mails
 * around should never double as a map of the database schema.
 */
export interface ImportColumn {
  header: string;
  field:
    | "phaseName"
    | "title"
    | "moduleName"
    | "assignees"
    | "startDate"
    | "endDate"
    | "statusPercent"
    | "description";
  required: boolean;
  width: number;
  example: string;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    header: "Phase",
    field: "phaseName",
    required: true,
    width: 28,
    example: "Reference Data & Configuration",
  },
  {
    header: "Activity",
    field: "title",
    required: true,
    width: 36,
    example: "Configure facility mapping",
  },
  {
    header: "Module / System code",
    field: "moduleName",
    required: false,
    width: 22,
    example: "OPD",
  },
  {
    header: "Assignee(s) — comma-separated",
    field: "assignees",
    required: false,
    width: 26,
    example: "Backend, DevOps",
  },
  {
    header: "Start date (YYYY-MM-DD)",
    field: "startDate",
    required: false,
    width: 20,
    example: "2026-11-03",
  },
  {
    header: "End date (YYYY-MM-DD)",
    field: "endDate",
    required: false,
    width: 20,
    example: "2026-11-14",
  },
  {
    header: "Progress % (0-100)",
    field: "statusPercent",
    required: false,
    width: 18,
    example: "0",
  },
  {
    header: "Notes",
    field: "description",
    required: false,
    width: 40,
    example: "",
  },
];

export const ACTIVITIES_SHEET_NAME = "Activities";
export const REFERENCE_SHEET_NAME = "Reference — phases & modules";
export const INSTRUCTIONS_SHEET_NAME = "Instructions";

export const TEMPLATE_INSTRUCTIONS = [
  'Fill in one row per activity on the "Activities" sheet — the header row must stay exactly as it is (don\'t rename, delete, or reorder columns).',
  'Phase should match an existing phase name exactly where one already exists — see the "Reference" sheet for the full list. If you type a phase name that doesn\'t exist yet, it will be created automatically, so a brand-new tracker can be filled in entirely from this sheet. Spell it consistently across rows — two slightly different spellings create two separate phases.',
  'Module / System code is optional — if used, it must match one of the module codes listed on the "Reference" sheet for a system already linked to this tracker.',
  'Assignee(s) are free-text role tags, not user accounts — separate more than one with a comma, e.g. "Backend, DevOps".',
  "Dates must be in YYYY-MM-DD format (e.g. 2026-11-03). Leave blank if not yet known.",
  "Progress % must be a whole number from 0 to 100. Leave blank to default to 0.",
  "Leave any other optional cell blank if you don't have that information yet — only Phase and Activity are required.",
  "Delete the example row before uploading, or leave it — any row where every cell is blank is skipped automatically.",
  'When ready, upload this file from the tracker page via "Import XLS → Upload XLS". Each row is checked before saving — rows with a problem are reported back to you and nothing in that row is saved until you fix it and re-upload.',
];
