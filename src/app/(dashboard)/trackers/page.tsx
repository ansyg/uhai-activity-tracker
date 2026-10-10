import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { JoinRequestButton } from "@/components/trackers/JoinRequestButton";
import { RemoveTrackerButton } from "@/components/trackers/RemoveTrackerButton";
import { TrackerSettingsEditor } from "@/components/trackers/TrackerSettingsEditor";
import { AvatarStack } from "@/components/AvatarStack";

export default async function TrackersPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [user, trackers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.tracker.findMany({
      where: {
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }, { visibility: "PUBLIC" }],
      },
      include: {
        owner: { select: { name: true } },
        systems: { include: { system: true } },
        memberships: {
          select: { userId: true, status: true, user: { select: { id: true, name: true } } },
        },
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div>
      <div className="page-hero">
        <div>
          <p className="greeting">Welcome back, {firstName}</p>
          <h1>Your trackers</h1>
        </div>
        <Link className="btn btn-primary" href="/trackers/new">
          New tracker
        </Link>
      </div>

      {trackers.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No trackers yet</p>
          <p className="muted" style={{ fontSize: "0.9em" }}>
            Create one to start tracking implementation work, or wait for a public tracker to appear here.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {trackers.map((tracker) => {
          const myMembership = tracker.memberships.find((m) => m.userId === userId);
          const isOwner = tracker.ownerId === userId;
          const isApprovedMember = isOwner || myMembership?.status === "APPROVED";
          const canOpen = isApprovedMember || tracker.visibility === "PUBLIC";
          const members = tracker.memberships.filter((m) => m.status === "APPROVED").map((m) => m.user);

          return (
            <div key={tracker.id} className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <h3 style={{ fontSize: "1.08rem" }}>{tracker.name}</h3>
                <span className={`badge ${tracker.visibility === "PUBLIC" ? "badge-accent" : "badge-neutral"}`}>
                  {tracker.visibility === "PUBLIC" ? "Public" : "Private"}
                </span>
              </div>

              <p className="muted" style={{ fontSize: "0.9em", flex: 1, minHeight: "2.6em" }}>
                {tracker.description ?? "No description yet."}
              </p>

              {tracker.systems.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {tracker.systems.map((link) => (
                    <span key={link.systemId} className="badge badge-neutral">
                      {link.system.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <AvatarStack people={members} />
                <div style={{ textAlign: "right" }}>
                  <div className="stat-value" style={{ fontSize: "1.2rem" }}>
                    {tracker._count.activities}
                  </div>
                  <div className="muted" style={{ fontSize: "0.72em" }}>
                    activities
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {canOpen && (
                  <Link className="btn" style={{ flex: 1 }} href={`/trackers/${tracker.id}`}>
                    Open
                  </Link>
                )}
                {!isOwner && !myMembership && tracker.visibility === "PUBLIC" && (
                  <JoinRequestButton trackerId={tracker.id} />
                )}
                {!isOwner && myMembership?.status === "PENDING" && (
                  <button className="btn" disabled style={{ flex: 1 }}>
                    Request pending
                  </button>
                )}
                {isOwner && <RemoveTrackerButton trackerId={tracker.id} />}
              </div>

              {/* Rendered as its own full-width block, not a sibling in the button row above —
                  the expanded form is much taller than those buttons and would otherwise stretch
                  them into tall, empty-looking pills. */}
              {isOwner && (
                <TrackerSettingsEditor
                  trackerId={tracker.id}
                  name={tracker.name}
                  description={tracker.description}
                  visibility={tracker.visibility}
                  canEdit
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
