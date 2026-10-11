import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const connection = await prisma.calendarConnection.findUnique({
      where: { userId },
      select: { calendarId: true, createdAt: true },
    });

    return NextResponse.json({
      connected: Boolean(connection),
      calendarId: connection?.calendarId ?? null,
      connectedAt: connection?.createdAt ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
