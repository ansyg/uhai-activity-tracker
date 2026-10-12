import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { BackLink } from "@/components/BackLink";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function UsersPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const grants = await getGlobalGrants(userId);
  if (!grants.has("users:VIEW")) notFound();

  const [users, limitRequests, pendingInvites, allRoles] = await Promise.all([
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
    grants.has("users:MANAGE")
      ? prisma.trackerLimitRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: {
              select: { id: true, name: true, email: true, maxTrackers: true },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    // Keyed by email (not a User relation — the recipient may not have an
    // account yet) so approving a pending signup can show it'll also seat
    // them into these trackers (see users/[id]/route.ts's auto-accept).
    prisma.trackerInvite.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      select: { email: true, tracker: { select: { name: true } } },
    }),
    grants.has("users:MANAGE")
      ? prisma.role.findMany({
          select: { id: true, name: true, permissions: { select: { permission: { select: { menu: { select: { scope: true } } } } } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Same "assignable globally" filter as GET /api/roles?scope=GLOBAL — a role
  // with no permissions yet, or whose permissions are all on GLOBAL-scope
  // menus, makes sense as a platform-wide UserRole; a tracker-role template
  // (Owner/Contributor/…) does not.
  const globalRoleOptions = allRoles
    .filter((role) => role.permissions.length === 0 || role.permissions.every((rp) => rp.permission.menu.scope === "GLOBAL"))
    .map((role) => ({ id: role.id, name: role.name }));

  const pendingInviteTrackersByEmail = new Map<string, string[]>();
  for (const invite of pendingInvites) {
    const list = pendingInviteTrackersByEmail.get(invite.email) ?? [];
    list.push(invite.tracker.name);
    pendingInviteTrackersByEmail.set(invite.email, list);
  }

  const rows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    subscriptionStatus: user.subscriptionStatus,
    maxTrackers: user.maxTrackers,
    ownedTrackerCount: user._count.ownedTrackers,
    createdAt: user.createdAt.toISOString(),
    signInMethod: user.passwordHash ? "Email and password" : "Google",
    globalRoles: user.globalRoles.map((r) => r.role.name),
    trackers: user.trackerMemberships.map((m) => m.tracker),
    pendingInviteTrackers: pendingInviteTrackersByEmail.get(user.email) ?? [],
  }));

  const limitRequestRows = limitRequests.map((r) => ({
    id: r.id,
    requestedMax: r.requestedMax,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
  }));

  const canManage = grants.has("users:MANAGE");

  return (
    <>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>Users</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Everyone registered on the platform, and which trackers they belong to.
        Anyone can create their own account from the sign-up page — share that
        link to invite someone. A new signup stays Pending until approved here,
        and can't create or join a tracker until then.
      </p>

      <UsersTable
        users={rows}
        canManage={canManage}
        currentUserId={userId}
        limitRequests={limitRequestRows}
        globalRoleOptions={globalRoleOptions}
      />
    </>
  );
}
