import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

const roleInclude = { permissions: { include: { permission: { include: { menu: true } } } } } as const;

/** Open to any signed-in user: an Owner/Admin picks from this list when inviting someone or deciding a join request. */
export async function GET(request: NextRequest) {
  try {
    await requireUserId();
    const scope = request.nextUrl.searchParams.get("scope"); // "TRACKER" | "GLOBAL" | null

    const roles = await prisma.role.findMany({ include: roleInclude, orderBy: { name: "asc" } });

    const filtered = scope
      ? roles.filter((role) =>
          role.permissions.length === 0 ||
          role.permissions.every((rp) => rp.permission.menu.scope === scope)
        )
      : roles;

    return NextResponse.json({ roles: filtered });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  permissionIds: z.array(z.string()).default([]),
});

/** Creating a custom role (e.g. "QA Lead") is a Roles & Permissions admin action. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const body = CreateRoleSchema.parse(await request.json());
    const role = await prisma.role.create({
      data: {
        name: body.name,
        description: body.description,
        isSystem: false,
        permissions: { create: body.permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: roleInclude,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
