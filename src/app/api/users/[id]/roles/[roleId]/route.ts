import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

/** Platform Admin only: revoke a global role from a user. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id: targetUserId, roleId } = await params;
    if (targetUserId === callerId) throw new BadRequestError("You can't edit your own roles here.");

    await prisma.userRole.deleteMany({ where: { userId: targetUserId, roleId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
