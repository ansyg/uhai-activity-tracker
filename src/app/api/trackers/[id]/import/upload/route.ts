import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { parseActivityImportFile } from "@/lib/activities/xlsx-import";
import { statusFromPercent } from "@/lib/activities/status";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — an activities sheet is small even at thousands of rows

// Every upload must be re-validated against the file bytes and DB state of
// that exact request — never served from or written to any cache layer.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, must-revalidate" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.activities", "CREATE");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BadRequestError("No file uploaded.");
    if (file.size > MAX_FILE_SIZE) throw new BadRequestError("File is too large (max 10MB).");

    const buffer = Buffer.from(await file.arrayBuffer());

    const [phases, trackerSystems] = await Promise.all([
      prisma.phase.findMany({ where: { trackerId }, select: { id: true, name: true } }),
      prisma.trackerSystem.findMany({
        where: { trackerId },
        include: { system: { include: { modules: { select: { id: true, name: true } } } } },
      }),
    ]);
    const modules = trackerSystems.flatMap((link) => link.system.modules);

    let parsed;
    try {
      parsed = await parseActivityImportFile(buffer, { phases, modules });
    } catch (err) {
      throw new BadRequestError(err instanceof Error ? err.message : "Couldn't read that file.");
    }

    if (parsed.valid.length === 0) {
      return NextResponse.json(
        { savedCount: 0, newPhaseCount: 0, invalidRows: parsed.invalid },
        { headers: NO_STORE_HEADERS }
      );
    }

    const savedCount = await prisma.$transaction(async (tx) => {
      // A brand new tracker import can reference phase names that don't
      // exist yet — create those first (in sheet order, appended after
      // whatever phases already exist) so every valid row has a real
      // phaseId to resolve to.
      const phaseIdByKey = new Map(phases.map((p) => [p.name.trim().toLowerCase(), p.id]));
      if (parsed.newPhaseNames.length > 0) {
        let nextSequence = (await tx.phase.count({ where: { trackerId } })) + 1;
        for (const name of parsed.newPhaseNames) {
          const created = await tx.phase.create({ data: { trackerId, name, sequence: nextSequence++ } });
          phaseIdByKey.set(name.trim().toLowerCase(), created.id);
        }
      }

      let count = 0;
      for (const row of parsed.valid) {
        const phaseId = phaseIdByKey.get(row.phaseKey);
        if (!phaseId) continue; // every valid row's phaseKey is guaranteed resolvable above
        await tx.activity.create({
          data: {
            trackerId,
            phaseId,
            moduleId: row.moduleId,
            title: row.title,
            description: row.description,
            statusPercent: row.statusPercent,
            status: statusFromPercent(row.statusPercent),
            startDate: row.startDate ? new Date(row.startDate) : undefined,
            endDate: row.endDate ? new Date(row.endDate) : undefined,
            assignees: { create: row.roleTags.map((roleTag) => ({ roleTag })) },
            history: {
              create: { changedById: userId, field: "created", newValue: row.title, source: "import" },
            },
          },
        });
        count++;
      }
      return count;
    });

    return NextResponse.json(
      { savedCount, newPhaseCount: parsed.newPhaseNames.length, invalidRows: parsed.invalid },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
