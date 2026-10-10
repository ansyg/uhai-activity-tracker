import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

/** Open to any signed-in user: the System Directory is reused when creating/searching a tracker. */
export async function GET(request: NextRequest) {
  try {
    await requireUserId();
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const systems = await prisma.system.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      include: { modules: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ systems });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateSystemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  url: z.string().url().optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
});

/** Registering a brand new system in the directory is a Platform Admin action. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await requireGlobalGrant(userId, "system_directory", "CREATE");

    const body = CreateSystemSchema.parse(await request.json());
    const system = await prisma.system.create({ data: body });

    return NextResponse.json({ system }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
