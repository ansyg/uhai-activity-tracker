import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import type { MembershipStatus } from "@prisma/client";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: trackerId } = await params;
    await requireTrackerGrant(userId, trackerId, "tracker.approvals", "VIEW");

    const status = request.nextUrl.searchParams.get("status") as MembershipStatus | null;

    const memberships = await prisma.trackerMembership.findMany({
      where: { trackerId, status: status ?? undefined },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({ memberships });
  } catch (error) {
    return handleApiError(error);
  }
}
