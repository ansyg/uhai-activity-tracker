import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { buildActivityImportTemplate } from "@/lib/activities/xlsx-template";
import { handleApiError } from "@/lib/api/errors";

// The Reference sheet (valid phases/modules) changes as the tracker evolves —
// every download must be regenerated from current data, never served stale.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    const { tracker } = await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.activities", "CREATE");

    const [phases, trackerSystems] = await Promise.all([
      prisma.phase.findMany({ where: { trackerId }, orderBy: { sequence: "asc" }, select: { name: true } }),
      prisma.trackerSystem.findMany({
        where: { trackerId },
        include: { system: { include: { modules: { select: { name: true } } } } },
      }),
    ]);

    const modules = trackerSystems.flatMap((link) =>
      link.system.modules.map((m) => ({ name: m.name, systemName: link.system.name }))
    );

    const buffer = await buildActivityImportTemplate({ trackerName: tracker.name, phases, modules });

    // Same cross-package Buffer type clash as xlsx-import.ts — identical at runtime.
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${tracker.name.replace(/[^a-zA-Z0-9 _-]/g, "_")} - activity import template.xlsx"`,
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
