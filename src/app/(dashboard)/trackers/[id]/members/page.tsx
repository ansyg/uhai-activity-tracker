import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getTrackerGrants } from "@/lib/rbac/permissions";
import { InviteForm } from "@/components/trackers/InviteForm";
import { BackLink } from "@/components/BackLink";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId } = await params;
  const grants = await getTrackerGrants(userId, trackerId);
  if (!grants.has("tracker.members:VIEW")) notFound();

  const [tracker, members, roles] = await Promise.all([
    prisma.tracker.findUnique({ where: { id: trackerId }, select: { name: true } }),
    prisma.trackerMembership.findMany({
      where: { trackerId, status: "APPROVED" },
      include: { user: { select: { id: true, name: true, email: true } }, role: true },
      orderBy: { requestedAt: "asc" },
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {members.map((membership) => (
          <div
            key={membership.userId}
            className="card"
            style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
                {initials(membership.user.name) || "?"}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{membership.user.name}</div>
                <div className="muted" style={{ fontSize: "0.85em" }}>
                  {membership.user.email}
                </div>
              </div>
            </div>
            <span className="badge badge-primary">{membership.role.name}</span>
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <h3 style={{ marginBottom: 12 }}>Invite by email</h3>
          <InviteForm trackerId={trackerId} roles={trackerRoles} />
        </>
      )}
    </div>
  );
}
