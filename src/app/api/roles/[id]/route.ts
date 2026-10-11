import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const roleInclude = { permissions: { include: { permission: { include: { menu: true } } } } } as const;

const PatchRoleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  permissionIds: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const { id } = await params;
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Role not found.");

    const body = PatchRoleSchema.parse(await request.json());

    // Seeded role names (e.g. "Owner", "Viewer") are looked up by name
    // elsewhere (tracker creation, join requests) — renaming one would
    // silently break those flows, so it's blocked here even though its
    // permission set can still be edited.
    if (existing.isSystem && body.name && body.name !== existing.name) {
      throw new BadRequestError("Built-in role names can't be changed.");
    }

    const role = await prisma.$transaction(async (tx) => {
      if (body.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: body.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      return tx.role.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description ?? undefined,
        },
        include: roleInclude,
      });
    });

    return NextResponse.json({ role });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Deleting a custom role is blocked while anyone still holds it — reassign them first. Built-in roles can't be deleted. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const { id } = await params;
    const [role, userRoleCount, membershipCount, inviteCount] = await Promise.all([
      prisma.role.findUnique({ where: { id } }),
      prisma.userRole.count({ where: { roleId: id } }),
      prisma.trackerMembership.count({ where: { roleId: id } }),
      prisma.trackerInvite.count({ where: { roleId: id } }),
    ]);
    if (!role) throw new NotFoundError("Role not found.");
    if (role.isSystem) throw new BadRequestError("Built-in roles can't be deleted.");

    const inUse = userRoleCount + membershipCount + inviteCount;
    if (inUse > 0) {
      throw new BadRequestError(
        `This role is still assigned to ${inUse} ${inUse === 1 ? "place" : "places"} (users, tracker members, or pending invites) — reassign them first.`
      );
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
