import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import {
  BadRequestError,
  NotFoundError,
  handleApiError,
} from "@/lib/api/errors";

const PatchModuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

async function loadModule(systemId: string, moduleId: string) {
  const module_ = await prisma.module.findFirst({
    where: { id: moduleId, systemId },
  });
  if (!module_) throw new NotFoundError("Module not found.");
  return module_;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "EDIT");

    const { id: systemId, moduleId } = await params;
    await loadModule(systemId, moduleId);

    const body = PatchModuleSchema.parse(await request.json());
    const module_ = await prisma.module.update({
      where: { id: moduleId },
      data: body,
    });

    return NextResponse.json({ module: module_ });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "EDIT");

    const { id: systemId, moduleId } = await params;
    await loadModule(systemId, moduleId);

    const activityCount = await prisma.activity.count({ where: { moduleId } });
    if (activityCount > 0) {
      throw new BadRequestError(
        `This module is used by ${activityCount} activit${activityCount === 1 ? "y" : "ies"} — reassign or remove those first.`,
      );
    }

    await prisma.module.delete({ where: { id: moduleId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
