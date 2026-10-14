import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchPhaseSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  sequence: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: trackerId, phaseId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.phases", "MANAGE");

    const existing = await prisma.phase.findFirst({ where: { id: phaseId, trackerId } });
    if (!existing) throw new NotFoundError("Phase not found.");

    const body = PatchPhaseSchema.parse(await request.json());
    const phase = await prisma.phase.update({ where: { id: phaseId }, data: body });

    return NextResponse.json({ phase });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: trackerId, phaseId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.phases", "MANAGE");

    const phase = await prisma.phase.findFirst({
      where: { id: phaseId, trackerId },
      include: { _count: { select: { activities: true } } },
    });
    if (!phase) throw new NotFoundError("Phase not found.");
    if (phase._count.activities > 0) {
      throw new BadRequestError("Move or delete its activities first — a phase with activities can't be deleted.");
    }

    await prisma.phase.delete({ where: { id: phaseId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
