import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
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

    const user = await prisma.$transaction(async (tx) => {
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
      return updated;
    });

    return NextResponse.json({
      user: { id: user.id, isActive: user.isActive, subscriptionStatus: user.subscriptionStatus },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
