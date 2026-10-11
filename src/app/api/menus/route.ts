import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { safeHref } from "@/lib/rbac/safe-href";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

/** Feeds the permission-matrix UI on the Roles & Permissions screen, and the sidebar's GLOBAL nav items. */
export async function GET() {
  try {
    await requireUserId();
    const menus = await prisma.menu.findMany({
      include: { permissions: true },
      orderBy: [{ scope: "asc" }, { order: "asc" }],
    });
    return NextResponse.json({ menus });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateMenuSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_.]*$/, "Use lowercase letters, numbers, underscores, and dots only (e.g. \"reports\" or \"tracker.reports\")."),
  label: z.string().min(1).max(200),
  scope: z.enum(["GLOBAL", "TRACKER"]),
  icon: z.string().max(50).optional(),
  href: safeHref.optional(),
  order: z.number().int().optional(),
  actions: z.array(z.enum(["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "MANAGE"])).min(1),
});

/**
 * A brand new feature's menu (+ one Permission row per chosen action) —
 * the point of the whole menu-based RBAC design (ARCHITECTURE.md §3): add
 * one here, tick it onto a role, and a route handler can gate on it with
 * requireGlobalGrant/requireTrackerGrant immediately, no deploy to add the
 * menu itself.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "roles_permissions", "MANAGE");

    const body = CreateMenuSchema.parse(await request.json());

    const existing = await prisma.menu.findUnique({ where: { key: body.key } });
    if (existing) throw new BadRequestError(`A menu with key "${body.key}" already exists.`);

    const menu = await prisma.menu.create({
      data: {
        key: body.key,
        label: body.label,
        scope: body.scope,
        icon: body.icon,
        href: body.scope === "GLOBAL" ? body.href : undefined,
        order: body.order ?? 0,
        isSystem: false,
        permissions: { create: body.actions.map((action) => ({ action })) },
      },
      include: { permissions: true },
    });

    return NextResponse.json({ menu }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
