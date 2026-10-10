import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchUserSchema = z.object({
  isActive: z.boolean(),
});

/** Platform Admin only: activate/deactivate a platform account. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id: targetUserId } = await params;
    if (targetUserId === callerId) {
      throw new BadRequestError("You can't deactivate your own account.");
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundError("User not found.");

    const { isActive } = PatchUserSchema.parse(await request.json());

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: targetUserId }, data: { isActive } });
      if (!isActive) {
        // Deactivating cuts off new sessions immediately; an already-issued
        // access token still runs out naturally within its own ~15 min life.
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });

    return NextResponse.json({ user: { id: user.id, isActive: user.isActive } });
  } catch (error) {
    return handleApiError(error);
  }
}
