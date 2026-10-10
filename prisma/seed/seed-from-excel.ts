/**
 * Seeds the database with the real, first tracker: "Afya Maoni x GOTHOMIS
 * Integration", read directly from the source-of-truth spreadsheet that
 * lives at the repo root. Call seedTrackerFromExcel() after seedRbac() -
 * see prisma/seed/index.ts, which is what `npm run seed` actually runs.
 */
import path from "node:path";
import { PrismaClient, ActivityStatus } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../../Afya Maoni GoTHOMIS Integration Tracker.xlsx"
);

const SHEET_NAME = "Implementation Tracker";
const FIRST_DATA_ROW = 19; // row 18 holds the header; data starts at 19
const LAST_DATA_ROW = 166;

interface RawActivityRow {
  phaseName: string;
  title: string;
  description: string | null;
  statusPercent: number;
  startDate: Date | null;
  endDate: Date | null;
  responsible: string | null;
}

function statusFromPercent(percent: number): ActivityStatus {
  if (percent >= 100) return ActivityStatus.COMPLETED;
  if (percent > 0) return ActivityStatus.IN_PROGRESS;
  return ActivityStatus.NOT_STARTED;
}

function readRows(): RawActivityRow[] {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${WORKBOOK_PATH}`);
  }

  const rows: RawActivityRow[] = [];
  let currentPhase = "";

  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    const cell = (col: string) => sheet[`${col}${r}`]?.v ?? null;

    const mainActivity = cell("B") as string | null;
    const subActivity = cell("C") as string | null;
    if (mainActivity) currentPhase = mainActivity;
    if (!subActivity) continue;

    const percentRaw = cell("E");
    const percent =
      typeof percentRaw === "number"
        ? Math.round(percentRaw <= 1 ? percentRaw * 100 : percentRaw)
        : 0;

    rows.push({
      phaseName: currentPhase,
      title: subActivity,
      description: cell("D") as string | null,
      statusPercent: percent,
      startDate: cell("F") as Date | null,
      endDate: cell("G") as Date | null,
      responsible: cell("H") as string | null,
    });
  }

  return rows;
}

export async function seedTrackerFromExcel(roleIdByName: Record<string, string>) {
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "gervaseanselm@gmail.com";

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail, name: "Tracker Owner" },
  });

  const rows = readRows();

  // Systems are a reusable directory, not something baked into this one
  // tracker: register GOTHOMIS and Afya Maoni once, so any future tracker
  // involving either of them can just reference the existing record
  // instead of re-entering its name/contact/URL/modules.
  const gothomis = await prisma.system.upsert({
    where: { name: "GOTHOMIS" },
    update: {},
    create: {
      name: "GOTHOMIS",
      description: "Government facility/hospital information system (PMORALG/MOH).",
      modules: {
        create: [
          { name: "OPD", description: "Outpatient service point." },
          { name: "IPD", description: "Inpatient service point." },
          { name: "RCH", description: "Reproductive & Child Health service point." },
          { name: "LAB", description: "Laboratory service point." },
          { name: "PHA", description: "Pharmacy service point." },
          { name: "EMD", description: "Emergency department service point." },
        ],
      },
    },
  });

  const afyaMaoni = await prisma.system.upsert({
    where: { name: "Afya Maoni" },
    update: {},
    create: {
      name: "Afya Maoni",
      description: "Client feedback / survey platform.",
      modules: {
        create: [
          { name: "IVR", description: "Interactive voice response feedback channel." },
          { name: "WhatsApp", description: "WhatsApp feedback channel." },
        ],
      },
    },
  });

  const tracker = await prisma.tracker.create({
    data: {
      name: "Afya Maoni x GOTHOMIS Integration",
      description:
        "Implementation tracker for integrating the GOTHOMIS facility system with the Afya Maoni client feedback platform.",
      ownerId: owner.id,
      visibility: "PRIVATE",
      memberships: {
        create: {
          userId: owner.id,
          roleId: roleIdByName["Owner"],
          status: "APPROVED",
          decidedAt: new Date(),
        },
      },
      systems: {
        create: [
          { systemId: gothomis.id, role: "SOURCE" },
          { systemId: afyaMaoni.id, role: "TARGET" },
        ],
      },
    },
  });

  const phaseNames = [...new Set(rows.map((r) => r.phaseName))];
  const phaseIdByName = new Map<string, string>();

  for (const [index, name] of phaseNames.entries()) {
    const phase = await prisma.phase.create({
      data: { trackerId: tracker.id, name, sequence: index + 1 },
    });
    phaseIdByName.set(name, phase.id);
  }

  for (const row of rows) {
    const activity = await prisma.activity.create({
      data: {
        trackerId: tracker.id,
        phaseId: phaseIdByName.get(row.phaseName)!,
        title: row.title,
        description: row.description,
        statusPercent: row.statusPercent,
        status: statusFromPercent(row.statusPercent),
        startDate: row.startDate,
        endDate: row.endDate,
      },
    });

    if (row.responsible) {
      const roleTags = row.responsible.split("/").map((t) => t.trim());
      await prisma.activityAssignee.createMany({
        data: roleTags.map((roleTag) => ({
          activityId: activity.id,
          roleTag,
        })),
      });
    }
  }

  console.log(
    `Seeded tracker "${tracker.name}" (systems: GOTHOMIS, Afya Maoni) with ${phaseNames.length} phases and ${rows.length} activities.`
  );
  console.log(
    "Note: activity-to-module tagging isn't in the spreadsheet as a structured column, so Activity.moduleId is left null here - assign modules via the UI/API once imported."
  );

  return owner;
}
