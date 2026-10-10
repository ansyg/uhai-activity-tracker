import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);

    const links = await prisma.trackerSystem.findMany({
      where: { trackerId },
      include: { system: true },
    });

    return NextResponse.json({ systems: links.map((link) => ({ system: link.system, role: link.role })) });
  } catch (error) {
    return handleApiError(error);
  }
}

const AddSystemSchema = z.object({
  systemId: z.string().min(1),
  role: z.enum(["SOURCE", "TARGET", "PARTICIPANT"]).default("PARTICIPANT"),
});

/** Links an already-registered system (from the System Directory) to this tracker. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.overview", "EDIT");

    const body = AddSystemSchema.parse(await request.json());

    const system = await prisma.system.findUnique({ where: { id: body.systemId } });
    if (!system) throw new NotFoundError("System not found.");

    const existing = await prisma.trackerSystem.findUnique({
      where: { trackerId_systemId: { trackerId, systemId: body.systemId } },
    });
    if (existing) throw new BadRequestError("That system is already linked to this tracker.");

    const link = await prisma.trackerSystem.create({
      data: { trackerId, systemId: body.systemId, role: body.role },
      include: { system: true },
    });

    return NextResponse.json({ link: { system: link.system, role: link.role } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
