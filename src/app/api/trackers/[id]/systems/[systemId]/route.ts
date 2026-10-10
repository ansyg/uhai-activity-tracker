import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const UpdateRoleSchema = z.object({
  role: z.enum(["SOURCE", "TARGET", "PARTICIPANT"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; systemId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: trackerId, systemId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.overview", "EDIT");

    const body = UpdateRoleSchema.parse(await request.json());

    const existing = await prisma.trackerSystem.findUnique({
      where: { trackerId_systemId: { trackerId, systemId } },
    });
    if (!existing) throw new NotFoundError("That system isn't linked to this tracker.");

    const link = await prisma.trackerSystem.update({
      where: { trackerId_systemId: { trackerId, systemId } },
      data: { role: body.role },
      include: { system: true },
    });

    return NextResponse.json({ link: { system: link.system, role: link.role } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; systemId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: trackerId, systemId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.overview", "EDIT");

    const existing = await prisma.trackerSystem.findUnique({
      where: { trackerId_systemId: { trackerId, systemId } },
    });
    if (!existing) throw new NotFoundError("That system isn't linked to this tracker.");

    await prisma.trackerSystem.delete({ where: { trackerId_systemId: { trackerId, systemId } } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
