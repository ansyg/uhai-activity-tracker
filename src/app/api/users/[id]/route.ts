import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { createNotification } from "@/lib/notifications/create";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    subscriptionStatus: z.enum(["APPROVED", "REJECTED"]).optional(),
  })
  .refine((body) => body.isActive !== undefined || body.subscriptionStatus !== undefined, {
    message: "Nothing to update.",
  });

/** Platform Admin only: activate/deactivate an account, or decide its pending platform subscription. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id: targetUserId } = await params;
    const body = PatchUserSchema.parse(await request.json());

    if (body.isActive !== undefined && targetUserId === callerId) {
      throw new BadRequestError("You can't deactivate your own account.");
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundError("User not found.");

    const { user, acceptedInvites } = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.subscriptionStatus !== undefined && { subscriptionStatus: body.subscriptionStatus }),
        },
      });
      if (body.isActive === false) {
        // Deactivating cuts off new sessions immediately; an already-issued
        // access token still runs out naturally within its own ~15 min life.
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // Approval unblocks any tracker invites this person was sent before (or
      // while) their account was pending — complete them now instead of
      // leaving the invitee to remember to revisit the original email link.
      const acceptedInvites: { trackerId: string; trackerName: string; invitedById: string }[] = [];
      if (body.subscriptionStatus === "APPROVED") {
        const pendingInvites = await tx.trackerInvite.findMany({
          where: { email: target.email, status: "PENDING", expiresAt: { gt: new Date() } },
          include: { tracker: { select: { name: true } } },
        });
        for (const invite of pendingInvites) {
          await tx.trackerMembership.upsert({
            where: { trackerId_userId: { trackerId: invite.trackerId, userId: targetUserId } },
            update: { status: "APPROVED", roleId: invite.roleId, decidedAt: new Date() },
            create: {
              trackerId: invite.trackerId,
              userId: targetUserId,
              roleId: invite.roleId,
              status: "APPROVED",
              decidedAt: new Date(),
            },
          });
          await tx.trackerInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
          acceptedInvites.push({ trackerId: invite.trackerId, trackerName: invite.tracker.name, invitedById: invite.invitedById });
        }
      }

      return { user: updated, acceptedInvites };
    });

    for (const invite of acceptedInvites) {
      await createNotification(invite.invitedById, "INVITE_ACCEPTED", {
        trackerId: invite.trackerId,
        trackerName: invite.trackerName,
        acceptedBy: targetUserId,
      });
    }

    return NextResponse.json({
      user: { id: user.id, isActive: user.isActive, subscriptionStatus: user.subscriptionStatus },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
