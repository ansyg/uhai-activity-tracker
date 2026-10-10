import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { handleApiError } from "@/lib/api/errors";

/** Feeds the permission-matrix UI on the Roles & Permissions screen. */
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
