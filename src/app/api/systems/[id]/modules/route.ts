import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const CreateModuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "EDIT");

    const { id: systemId } = await params;
    const system = await prisma.system.findUnique({ where: { id: systemId } });
    if (!system) throw new NotFoundError("System not found.");

    const body = CreateModuleSchema.parse(await request.json());
    const module_ = await prisma.module.create({ data: { ...body, systemId } });

    return NextResponse.json({ module: module_ }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
