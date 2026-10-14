import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const PatchSystemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  url: z.string().url().nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "EDIT");

    const { id } = await params;
    const existing = await prisma.system.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("System not found.");

    const body = PatchSystemSchema.parse(await request.json());
    const system = await prisma.system.update({ where: { id }, data: body });

    return NextResponse.json({ system });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "DELETE");

    const { id } = await params;
    const system = await prisma.system.findUnique({
      where: { id },
      include: {
        _count: { select: { trackerLinks: true } },
        modules: { include: { _count: { select: { activities: true } } } },
      },
    });
    if (!system) throw new NotFoundError("System not found.");

    if (system._count.trackerLinks > 0) {
      throw new BadRequestError(
        `Unlink this system from all trackers first — it's still linked to ${system._count.trackerLinks} tracker${system._count.trackerLinks === 1 ? "" : "s"}.`
      );
    }
    const moduleInUse = system.modules.find((m) => m._count.activities > 0);
    if (moduleInUse) {
      throw new BadRequestError(
        `Its "${moduleInUse.name}" module is still used by ${moduleInUse._count.activities} activit${moduleInUse._count.activities === 1 ? "y" : "ies"} — reassign or remove those first.`
      );
    }

    await prisma.$transaction([
      prisma.module.deleteMany({ where: { systemId: id } }),
      prisma.system.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
