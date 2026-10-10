import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { handleApiError } from "@/lib/api/errors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);

    const phases = await prisma.phase.findMany({
      where: { trackerId },
      orderBy: { sequence: "asc" },
      include: { _count: { select: { activities: true } } },
    });

    return NextResponse.json({ phases });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreatePhaseSchema = z.object({
  name: z.string().min(1).max(300),
  sequence: z.number().int().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await loadTrackerForViewer(trackerId, userId);
    await requireTrackerGrant(userId, trackerId, "tracker.activities", "CREATE");

    const body = CreatePhaseSchema.parse(await request.json());
    const sequence = body.sequence ?? (await prisma.phase.count({ where: { trackerId } })) + 1;

    const phase = await prisma.phase.create({
      data: { trackerId, name: body.name, sequence },
    });

    return NextResponse.json({ phase }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
