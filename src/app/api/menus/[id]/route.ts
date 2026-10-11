import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { safeHref } from "@/lib/rbac/safe-href";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "MANAGE"] as const;

const PatchMenuSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  icon: z.string().max(50).nullable().optional(),
  href: safeHref.nullable().optional(),
  order: z.number().int().optional(),
  actions: z.array(z.enum(ACTIONS)).optional(),
});

/**
 * Renaming/re-iconing/reordering a menu, or changing which actions it has
 * (each action is a Permission row some Role may already grant). A
 * built-in (isSystem) menu can only gain actions here, never lose one —
 * route handlers reference its existing permission keys as string
 * literals, so removing one would silently turn every check against it
 * into an unconditional deny.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const { id } = await params;
    const existing = await prisma.menu.findUnique({ where: { id }, include: { permissions: true } });
    if (!existing) throw new NotFoundError("Menu not found.");

    const body = PatchMenuSchema.parse(await request.json());

    if (body.actions) {
      const existingActions = new Set(existing.permissions.map((p) => p.action));
      const nextActions = new Set(body.actions);
      const removed = [...existingActions].filter((a) => !nextActions.has(a));
      if (existing.isSystem && removed.length > 0) {
        throw new BadRequestError(
          `Can't remove ${removed.join(", ")} from a built-in menu — the app may already check for it in code.`
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.menu.update({
        where: { id },
        data: {
          label: body.label,
          icon: body.icon,
          href: existing.scope === "GLOBAL" ? body.href : undefined,
          order: body.order,
        },
      });

      if (body.actions) {
        const existingByAction = new Map(existing.permissions.map((p) => [p.action, p.id]));
        const nextActions = new Set(body.actions);

        const toAdd = body.actions.filter((a) => !existingByAction.has(a));
        const toRemove = [...existingByAction.entries()].filter(([action]) => !nextActions.has(action));

        if (toAdd.length > 0) {
          await tx.permission.createMany({ data: toAdd.map((action) => ({ menuId: id, action })) });
        }
        for (const [, permissionId] of toRemove) {
          await tx.rolePermission.deleteMany({ where: { permissionId } });
          await tx.permission.delete({ where: { id: permissionId } });
        }
      }
    });

    const menu = await prisma.menu.findUnique({ where: { id }, include: { permissions: true } });
    return NextResponse.json({ menu });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Deleting a custom menu cascades its Permissions and any Role grants on them. Built-in menus can't be deleted. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const { id } = await params;
    const menu = await prisma.menu.findUnique({
      where: { id },
      include: { permissions: true, children: true },
    });
    if (!menu) throw new NotFoundError("Menu not found.");
    if (menu.isSystem) throw new BadRequestError("Built-in menus can't be deleted.");
    if (menu.children.length > 0) throw new BadRequestError("Delete this menu's sub-menus first.");

    await prisma.$transaction(async (tx) => {
      const permissionIds = menu.permissions.map((p) => p.id);
      await tx.rolePermission.deleteMany({ where: { permissionId: { in: permissionIds } } });
      await tx.permission.deleteMany({ where: { menuId: id } });
      await tx.menu.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
