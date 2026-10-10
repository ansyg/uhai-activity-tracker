import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

    const notifications = await prisma.notification.findMany({
      where: { userId, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}
