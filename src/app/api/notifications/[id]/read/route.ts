import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) throw new NotFoundError("Notification not found.");

    const updated = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return NextResponse.json({ notification: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
