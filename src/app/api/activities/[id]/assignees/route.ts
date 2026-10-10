import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const CreateAssigneeSchema = z
  .object({
    userId: z.string().min(1).optional(),
    roleTag: z.string().min(1).max(100).optional(),
  })
  .refine((body) => Boolean(body.userId) !== Boolean(body.roleTag), {
    message: "Provide exactly one of userId or roleTag.",
  });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, callerId);
    await requireTrackerGrant(callerId, activity.trackerId, "tracker.activities", "EDIT");

    const body = CreateAssigneeSchema.parse(await request.json());

    if (body.userId) {
      const membership = await prisma.trackerMembership.findUnique({
        where: { trackerId_userId: { trackerId: activity.trackerId, userId: body.userId } },
      });
      if (!membership || membership.status !== "APPROVED") {
        throw new BadRequestError("That person isn't an approved member of this tracker.");
      }
    }

    const assignee = await prisma.activityAssignee.create({
      data: { activityId, userId: body.userId, roleTag: body.roleTag },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ assignee }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
