import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { createNotification } from "@/lib/notifications/create";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const DecideSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

/** Platform Admin only: approve (raises the requester's maxTrackers) or reject a limit request. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id } = await params;
    const { decision } = DecideSchema.parse(await request.json());

    const limitRequest = await prisma.trackerLimitRequest.findUnique({ where: { id } });
    if (!limitRequest) throw new NotFoundError("Request not found.");
    if (limitRequest.status !== "PENDING") {
      throw new BadRequestError(`This request has already been ${limitRequest.status.toLowerCase()}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const decided = await tx.trackerLimitRequest.update({
        where: { id },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedById: callerId,
          decidedAt: new Date(),
        },
      });
      if (decision === "APPROVE") {
        await tx.user.update({ where: { id: limitRequest.userId }, data: { maxTrackers: limitRequest.requestedMax } });
      }
      return decided;
    });

    await createNotification(limitRequest.userId, "TRACKER_LIMIT_DECIDED", {
      decision: decision === "APPROVE" ? "approve" : "reject",
      requestedMax: limitRequest.requestedMax,
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
