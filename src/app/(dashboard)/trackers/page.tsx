import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { JoinRequestButton } from "@/components/trackers/JoinRequestButton";
import { RemoveTrackerButton } from "@/components/trackers/RemoveTrackerButton";
import { TrackerSettingsEditor } from "@/components/trackers/TrackerSettingsEditor";
import { AvatarStack } from "@/components/AvatarStack";
import { ProgressRing } from "@/components/trackers/ProgressRing";

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

  // Grouped/aggregate queries across every visible tracker at once, instead
  // of one dashboard query per card — this page can list many trackers.
  const trackerIds = trackers.map((t) => t.id);
  const [statusCounts, overdueRows] = await Promise.all([
    prisma.activity.groupBy({ by: ["trackerId", "status"], where: { trackerId: { in: trackerIds } }, _count: true }),
    prisma.activity.findMany({
      where: { trackerId: { in: trackerIds }, status: { not: "COMPLETED" }, endDate: { lt: new Date() } },
      select: { trackerId: true },
    }),
  ]);

  const progressByTracker = new Map<string, { total: number; completed: number; inProgress: number; notStarted: number; overdue: number }>();
  for (const row of statusCounts) {
    const entry = progressByTracker.get(row.trackerId) ?? { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 };
    entry.total += row._count;
    if (row.status === "COMPLETED") entry.completed += row._count;
    if (row.status === "IN_PROGRESS") entry.inProgress += row._count;
    if (row.status === "NOT_STARTED") entry.notStarted += row._count;
    progressByTracker.set(row.trackerId, entry);
  }
  for (const row of overdueRows) {
    const entry = progressByTracker.get(row.trackerId);
    if (entry) entry.overdue += 1;
  }

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
          const progress =
            progressByTracker.get(tracker.id) ?? { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 };

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

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ProgressRing completed={progress.completed} inProgress={progress.inProgress} notStarted={progress.notStarted} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8em", flex: 1 }}>
                  <LegendRow color="var(--status-completed)" label="Completed" value={progress.completed} />
                  <LegendRow color="var(--status-in-progress)" label="In progress" value={progress.inProgress} />
                  <LegendRow color="var(--status-not-started)" label="Not started" value={progress.notStarted} />
                  {progress.overdue > 0 && <LegendRow color="var(--danger)" label="Overdue" value={progress.overdue} />}
                </div>
              </div>

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
                  calendarSyncEnabled={tracker.calendarSyncEnabled}
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

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      <span className="muted" style={{ flex: 1 }}>
        {label}
      </span>
      <span style={{ fontWeight: 650 }}>{value}</span>
    </div>
  );
}
