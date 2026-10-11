import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getTrackerGrants } from "@/lib/rbac/permissions";
import { ApprovalActions } from "@/components/trackers/ApprovalActions";
import { BackLink } from "@/components/BackLink";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function ApprovalsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId } = await params;
  const grants = await getTrackerGrants(userId, trackerId);
  if (!grants.has("tracker.approvals:VIEW")) notFound();

  const [tracker, pending, roles] = await Promise.all([
    prisma.tracker.findUnique({ where: { id: trackerId }, select: { name: true } }),
    prisma.trackerMembership.findMany({
      where: { trackerId, status: "PENDING" },
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

  const canApprove = grants.has("tracker.approvals:APPROVE");

  return (
    <div>
      <BackLink href={`/trackers/${trackerId}`} label={tracker.name} />
      <h1 style={{ margin: "0 0 6px" }}>Join requests</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        People who&apos;ve asked to join this tracker.
      </p>

      {pending.length === 0 && (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <p style={{ fontWeight: 600 }}>No pending requests</p>
          <p className="muted" style={{ fontSize: "0.9em", marginTop: 4 }}>
            New requests will show up here for you to approve or decline.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pending.map((membership) => (
          <div
            key={membership.userId}
            className="card"
            style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}
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
                <div className="muted" style={{ fontSize: "0.78em" }}>
                  Requested {new Date(membership.requestedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            {canApprove ? (
              <ApprovalActions trackerId={trackerId} userId={membership.userId} roles={trackerRoles} defaultRoleId={membership.roleId} />
            ) : (
              <span className="muted" style={{ fontSize: "0.85em" }}>
                View only
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
