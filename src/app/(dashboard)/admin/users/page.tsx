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

  const [users, limitRequests] = await Promise.all([
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
          include: { user: { select: { id: true, name: true, email: true, maxTrackers: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

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
    <div style={{ maxWidth: 900 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>Users</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Everyone registered on the platform, and which trackers they belong to. Anyone can create their own account
        from the sign-up page — share that link to invite someone. A new signup stays Pending until approved here, and
        can't create or join a tracker until then.
      </p>

      <UsersTable
        users={rows}
        canManage={canManage}
        currentUserId={userId}
        limitRequests={limitRequestRows}
      />
    </div>
  );
}
