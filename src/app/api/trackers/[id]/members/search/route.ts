import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

/**
 * Lets someone inviting by email "@mention" an already-registered user
 * instead of retyping an address they might get wrong — same permission as
 * sending the invite itself (tracker.members:MANAGE), and deliberately
 * returns only name/email/id (not the admin-only fields /api/users exposes)
 * since any Admin/Owner on any tracker can call this, not just Platform
 * Admins.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.members", "MANAGE");

    const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/^@/, "").trim();
    if (q.length < 2) return NextResponse.json({ users: [] });

    const [existingMemberIds, pendingInviteEmails] = await Promise.all([
      prisma.trackerMembership.findMany({ where: { trackerId }, select: { userId: true } }),
      prisma.trackerInvite.findMany({ where: { trackerId, status: "PENDING" }, select: { email: true } }),
    ]);
    const pendingSet = new Set(pendingInviteEmails.map((i) => i.email));

    // Already-pending invitees are still shown (just flagged) rather than
    // hidden — an owner mentioning a stuck invite to resend it is exactly
    // this screen's main job. Only full members are excluded outright.
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { notIn: existingMemberIds.map((m) => m.userId) },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 8,
    });

    return NextResponse.json({
      users: users.map((u) => ({ ...u, alreadyInvited: pendingSet.has(u.email) })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
