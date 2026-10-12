import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getTrackerGrants } from "@/lib/rbac/permissions";
import { TrackerMembers } from "@/components/trackers/TrackerMembers";
import { TrackerInvites } from "@/components/trackers/TrackerInvites";
import { BackLink } from "@/components/BackLink";

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId } = await params;
  const grants = await getTrackerGrants(userId, trackerId);
  if (!grants.has("tracker.members:VIEW")) notFound();

  const [tracker, members, pendingInvites, roles] = await Promise.all([
    prisma.tracker.findUnique({ where: { id: trackerId }, select: { name: true, ownerId: true } }),
    prisma.trackerMembership.findMany({
      where: { trackerId, status: "APPROVED" },
      include: { user: { select: { id: true, name: true, email: true } }, role: true },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.trackerInvite.findMany({
      where: { trackerId, status: "PENDING" },
      include: { role: true, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({
      include: { permissions: { include: { permission: { include: { menu: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!tracker) notFound();

  const trackerRoles = roles
    .filter((role) => role.permissions.every((rp) => rp.permission.menu.scope === "TRACKER"))
    .map((role) => ({ id: role.id, name: role.name }));

  const canManage = grants.has("tracker.members:MANAGE");

  return (
    <div>
      <BackLink href={`/trackers/${trackerId}`} label={tracker.name} />
      <h1 style={{ margin: "0 0 6px" }}>Members</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Everyone with approved access to this tracker.
      </p>

      <TrackerMembers
        trackerId={trackerId}
        ownerId={tracker.ownerId}
        canManage={canManage}
        roles={trackerRoles}
        initialMembers={members.map((membership) => ({
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          roleId: membership.roleId,
          roleName: membership.role.name,
        }))}
      />

      <TrackerInvites
        trackerId={trackerId}
        roles={trackerRoles}
        canManage={canManage}
        initialInvites={pendingInvites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          roleName: invite.role.name,
          invitedByName: invite.invitedBy.name,
          createdAt: invite.createdAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}
