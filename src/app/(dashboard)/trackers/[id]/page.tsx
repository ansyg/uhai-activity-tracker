import { AvatarStack } from "@/components/AvatarStack";
import { BackLink } from "@/components/BackLink";
import { DeleteTrackerButton } from "@/components/trackers/DeleteTrackerButton";
import { ImportXlsButton } from "@/components/trackers/ImportXlsButton";
import { TrackerBoard } from "@/components/trackers/TrackerBoard";
import { TrackerCalendarSyncButton } from "@/components/trackers/TrackerCalendarSyncButton";
import { TrackerDatesEditor } from "@/components/trackers/TrackerDatesEditor";
import { TrackerSettingsEditor } from "@/components/trackers/TrackerSettingsEditor";
import { TrackerSystemsEditor } from "@/components/trackers/TrackerSystemsEditor";
import { getCurrentUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTrackerGrants } from "@/lib/rbac/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function TrackerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId } = await params;

  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      systems: { include: { system: { include: { modules: true } } } },
    },
  });
  if (!tracker) notFound();

  const moduleOptions = tracker.systems.flatMap((link) => link.system.modules);

  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId } },
  });
  const isOwner = tracker.ownerId === userId;
  const isApprovedMember = membership?.status === "APPROVED";
  if (tracker.visibility === "PRIVATE" && !isOwner && !isApprovedMember)
    notFound();

  const [phases, grants, approvedMembers, pendingRequestCount] =
    await Promise.all([
      prisma.phase.findMany({
        where: { trackerId },
        orderBy: { sequence: "asc" },
        include: {
          activities: {
            orderBy: { createdAt: "asc" },
            include: {
              module: { select: { id: true, name: true } },
              assignees: {
                include: { user: { select: { id: true, name: true } } },
              },
              history: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { changedBy: { select: { name: true } } },
              },
              checklistItems: { select: { done: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      }),
      getTrackerGrants(userId, trackerId),
      prisma.trackerMembership.findMany({
        where: { trackerId, status: "APPROVED" },
        select: { user: { select: { id: true, name: true } } },
      }),
      prisma.trackerMembership.count({
        where: { trackerId, status: "PENDING" },
      }),
    ]);

  const boardPhases = phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    sequence: phase.sequence,
    activities: phase.activities.map((activity) => ({
      ...activity,
      commentCount: activity._count.comments,
      checklistDone: activity.checklistItems.filter((i) => i.done).length,
      checklistTotal: activity.checklistItems.length,
      lastUpdatedBy: activity.history[0]?.changedBy?.name ?? null,
      lastUpdatedAt: activity.history[0]?.createdAt ?? null,
    })),
  }));

  const canEditActivities = grants.has("tracker.activities:EDIT");
  const canCreateActivities = grants.has("tracker.activities:CREATE");
  const canDeleteActivities = grants.has("tracker.activities:DELETE");
  const canManagePhases = grants.has("tracker.phases:MANAGE");
  const canViewApprovals = grants.has("tracker.approvals:VIEW");
  const canManageMembers = grants.has("tracker.members:VIEW");
  const canEditTracker = grants.has("tracker.overview:EDIT");
  const canDeleteTracker = grants.has("tracker.overview:DELETE");
  const canManageCalendar = grants.has("tracker.calendar:MANAGE");

  return (
    <div>
      <BackLink href="/trackers" label="Trackers" />
      <div className="page-hero">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <h1>{tracker.name}</h1>
            <span
              className={`badge ${tracker.visibility === "PUBLIC" ? "badge-accent" : "badge-neutral"}`}
            >
              {tracker.visibility === "PUBLIC" ? "Public" : "Private"}
            </span>
          </div>
          <p className="muted" style={{ maxWidth: 560 }}>
            {tracker.description}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <AvatarStack people={approvedMembers.map((m) => m.user)} />
          </div>
          {/* Its own full-width block, not a flex sibling — the expanded editor is a tall
              card and would otherwise squeeze/misalign whatever sits beside it in a flex row. */}
          <div style={{ marginTop: 10 }}>
            <TrackerSystemsEditor
              trackerId={trackerId}
              initialSystems={tracker.systems.map((link) => ({
                system: { id: link.system.id, name: link.system.name },
                role: link.role,
              }))}
              canEdit={canEditTracker}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TrackerDatesEditor
              trackerId={trackerId}
              startDate={tracker.startDate}
              endDate={tracker.endDate}
              canEdit={canEditTracker}
            />
          </div>
          {canEditTracker && (
            <div style={{ marginTop: 10 }}>
              <TrackerSettingsEditor
                trackerId={trackerId}
                name={tracker.name}
                description={tracker.description}
                visibility={tracker.visibility}
                calendarSyncEnabled={tracker.calendarSyncEnabled}
                canEdit={canEditTracker}
              />
            </div>
          )}
          {canManageCalendar && (
            <div style={{ marginTop: 10 }}>
              <TrackerCalendarSyncButton
                trackerId={trackerId}
                calendarSyncEnabled={tracker.calendarSyncEnabled}
              />
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          <Link className="btn" href={`/trackers/${trackerId}/timeline`}>
            Timeline
          </Link>
          <Link
            className="btn"
            href={`/reports/${trackerId}`}
            target="_blank"
            rel="noreferrer"
          >
            Export report
          </Link>
          {canViewApprovals && (
            <Link className="btn" href={`/trackers/${trackerId}/approvals`}>
              Join requests
              <span className="badge badge-neutral" style={{ marginLeft: 8 }}>
                {pendingRequestCount}
              </span>
            </Link>
          )}
          {canManageMembers && (
            <Link className="btn" href={`/trackers/${trackerId}/members`}>
              Members
              <span className="badge badge-neutral" style={{ marginLeft: 8 }}>
                {approvedMembers.length}
              </span>
            </Link>
          )}
          {canCreateActivities && <ImportXlsButton trackerId={trackerId} />}
        </div>
      </div>

      <TrackerBoard
        trackerId={trackerId}
        initialPhases={boardPhases}
        canEditActivities={canEditActivities}
        canCreateActivities={canCreateActivities}
        canDeleteActivities={canDeleteActivities}
        canManagePhases={canManagePhases}
        moduleOptions={moduleOptions}
        members={approvedMembers.map((m) => m.user)}
      />

      {canDeleteTracker && (
        <div style={{ marginTop: 48 }}>
          <h3 style={{ marginBottom: 14 }}>Danger zone</h3>
          <DeleteTrackerButton
            trackerId={trackerId}
            trackerName={tracker.name}
          />
        </div>
      )}
    </div>
  );
}
