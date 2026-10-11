import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { createNotifications } from "@/lib/notifications/create";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

/** Platform Admin only: every pending (and recent) ask to raise a user's tracker limit. */
export async function GET() {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const requests = await prisma.trackerLimitRequest.findMany({
      include: { user: { select: { id: true, name: true, email: true, maxTrackers: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateLimitRequestSchema = z.object({
  requestedMax: z.number().int().min(1).max(1000),
  reason: z.string().max(2000).optional(),
});

/** A user asks the platform owner to raise how many trackers they may own. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = CreateLimitRequestSchema.parse(await request.json());

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, maxTrackers: true },
    });
    if (body.requestedMax <= user.maxTrackers) {
      throw new BadRequestError(`Your current limit is already ${user.maxTrackers}.`);
    }

    const existingPending = await prisma.trackerLimitRequest.findFirst({
      where: { userId, status: "PENDING" },
    });
    if (existingPending) {
      throw new BadRequestError("You already have a pending request — wait for it to be decided before asking again.");
    }

    const limitRequest = await prisma.trackerLimitRequest.create({
      data: { userId, requestedMax: body.requestedMax, reason: body.reason },
    });

    const admins = await prisma.userRole.findMany({
      where: { role: { name: "Platform Admin" } },
      select: { userId: true },
    });
    await createNotifications(
      admins.map((a) => a.userId),
      "TRACKER_LIMIT_REQUESTED",
      { requesterId: userId, requesterName: user.name, requestedMax: body.requestedMax }
    );

    return NextResponse.json({ request: limitRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
