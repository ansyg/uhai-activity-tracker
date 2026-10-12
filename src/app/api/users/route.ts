import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

/** Platform Admin only: every registered account, with which trackers they belong to. */
export async function GET() {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "VIEW");

    const [users, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          subscriptionStatus: true,
          maxTrackers: true,
          createdAt: true,
          passwordHash: true,
          globalRoles: { select: { role: { select: { name: true } } } },
          trackerMemberships: {
            where: { status: "APPROVED" },
            select: { tracker: { select: { id: true, name: true } } },
          },
          _count: { select: { ownedTrackers: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      // Keyed by email (not a User relation — the recipient may not have an
      // account yet) so approving a pending signup can show it'll also seat
      // them into these trackers (see users/[id]/route.ts's auto-accept).
      prisma.trackerInvite.findMany({
        where: { status: "PENDING", expiresAt: { gt: new Date() } },
        select: { email: true, tracker: { select: { name: true } } },
      }),
    ]);

    const pendingInviteTrackersByEmail = new Map<string, string[]>();
    for (const invite of pendingInvites) {
      const list = pendingInviteTrackersByEmail.get(invite.email) ?? [];
      list.push(invite.tracker.name);
      pendingInviteTrackersByEmail.set(invite.email, list);
    }

    const result = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      subscriptionStatus: user.subscriptionStatus,
      maxTrackers: user.maxTrackers,
      ownedTrackerCount: user._count.ownedTrackers,
      createdAt: user.createdAt,
      signInMethod: user.passwordHash ? "Email and password" : "Google",
      globalRoles: user.globalRoles.map((r) => r.role.name),
      trackers: user.trackerMemberships.map((m) => m.tracker),
      pendingInviteTrackers: pendingInviteTrackersByEmail.get(user.email) ?? [],
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    return handleApiError(error);
  }
}
