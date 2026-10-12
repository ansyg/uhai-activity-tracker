import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const AddRoleSchema = z.object({ roleId: z.string().min(1) });

/** Platform Admin only: grant a global role (e.g. "Platform Admin") to a user. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id: targetUserId } = await params;
    if (targetUserId === callerId) throw new BadRequestError("You can't edit your own roles here.");

    const { roleId } = AddRoleSchema.parse(await request.json());

    const [target, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } }),
      prisma.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } }),
    ]);
    if (!target) throw new NotFoundError("User not found.");
    if (!role) throw new NotFoundError("Role not found.");

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUserId, roleId } },
      update: {},
      create: { userId: targetUserId, roleId },
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
