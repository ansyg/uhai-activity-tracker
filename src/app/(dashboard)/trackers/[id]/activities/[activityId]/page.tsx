import { BackLink } from "@/components/BackLink";
import { ActivityComments } from "@/components/trackers/ActivityComments";
import { ActivityTitleCell, AssigneesCell, DatesCell, ProgressStatusCell, NotesLinkCell } from "@/components/trackers/ActivityCells";
import { ActivityDetailsEditor } from "@/components/trackers/ActivityDetailsEditor";
import { ActivityChecklist } from "@/components/trackers/ActivityChecklist";
import { ActivityAttachments } from "@/components/trackers/ActivityAttachments";
import { AssigneeManager } from "@/components/trackers/AssigneeManager";
import { DeleteActivityButton } from "@/components/trackers/DeleteActivityButton";
import { getCurrentUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getTrackerGrants } from "@/lib/rbac/permissions";
import { notFound, redirect } from "next/navigation";

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  moduleId: "Module",
  phaseId: "Phase",
  statusPercent: "Progress",
  status: "Status",
  startDate: "Start date",
  endDate: "End date",
  created: "Created",
};

const DATE_FIELDS = new Set(["startDate", "endDate"]);

/** History values are stored as plain serialized strings — ISO datetimes for date fields need reformatting to read nicely. */
function formatHistoryValue(field: string, value: string | null): string {
  if (value === null) return "—";
  if (DATE_FIELDS.has(field)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  if (field === "statusPercent") return `${value}%`;
  return value;
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId, activityId } = await params;

  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    include: { systems: { include: { system: { include: { modules: true } } } } },
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

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, trackerId },
    include: {
      phase: { select: { id: true, name: true } },
      module: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      history: {
        include: { changedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      checklistItems: { orderBy: { sequence: "asc" } },
      attachments: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { comments: true } },
    },
  });
  if (!activity) notFound();

  const [grants, approvedMembers, phases] = await Promise.all([
    getTrackerGrants(userId, trackerId),
    prisma.trackerMembership.findMany({
      where: { trackerId, status: "APPROVED" },
      select: { user: { select: { id: true, name: true } } },
    }),
    prisma.phase.findMany({ where: { trackerId }, orderBy: { sequence: "asc" }, select: { id: true, name: true } }),
  ]);
  const canEdit = grants.has("tracker.activities:EDIT");
  const canDelete = grants.has("tracker.activities:DELETE");

  return (
    <div>
      <BackLink href={`/trackers/${trackerId}`} label={tracker.name} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p className="muted" style={{ fontSize: "0.85em", marginBottom: 4 }}>
              {activity.phase.name}
            </p>
            <h1>{activity.title}</h1>
            {activity.description && (
              <p className="muted" style={{ marginTop: 8, maxWidth: 600 }}>
                {activity.description}
              </p>
            )}
            {activity.module && (
              <span className="badge badge-neutral" style={{ marginTop: 8 }}>
                {activity.module.name}
              </span>
            )}
          </div>
          <ActivityDetailsEditor
            activityId={activity.id}
            title={activity.title}
            description={activity.description}
            moduleId={activity.moduleId}
            phaseId={activity.phaseId}
            modules={moduleOptions}
            phases={phases}
            canEdit={canEdit}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="field-label">Assignees</label>
          <AssigneeManager
            activityId={activity.id}
            assignees={activity.assignees}
            members={approvedMembers.map((m) => m.user)}
            canEdit={canEdit}
          />
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 28 }}>
        <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 680,
            borderCollapse: "collapse",
            fontSize: "0.9em",
          }}
        >
          <thead>
            <tr
              style={{ textAlign: "left", background: "var(--surface-muted)" }}
            >
              <th style={{ padding: "10px 14px" }}>Activity</th>
              <th style={{ padding: "10px 14px" }}>Assignees</th>
              <th style={{ padding: "10px 14px" }}>Dates</th>
              <th style={{ padding: "10px 14px" }}>Progress & status</th>
              <th style={{ padding: "10px 14px", width: 56 }} />
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "10px 14px" }}>
                <ActivityTitleCell activity={activity} trackerId={trackerId} />
              </td>
              <td style={{ padding: "10px 14px" }}>
                <AssigneesCell activity={activity} canEdit={canEdit} />
              </td>
              <td style={{ padding: "10px 14px" }}>
                <DatesCell activity={activity} canEdit={canEdit} />
              </td>
              <td style={{ padding: "10px 14px" }}>
                <ProgressStatusCell activity={activity} canEdit={canEdit} />
              </td>
              <td style={{ padding: "10px 14px" }}>
                <NotesLinkCell activity={activity} trackerId={trackerId} commentCount={activity._count.comments} />
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {(canEdit || activity.checklistItems.length > 0) && (
        <>
          <h3 style={{ marginBottom: 14 }}>Checklist</h3>
          <div className="card" style={{ padding: 20, marginBottom: 28 }}>
            <ActivityChecklist
              activityId={activity.id}
              initialItems={activity.checklistItems}
              canEdit={canEdit}
            />
          </div>
        </>
      )}

      {(canEdit || activity.attachments.length > 0) && (
        <>
          <h3 style={{ marginBottom: 14 }}>Attachments</h3>
          <div className="card" style={{ padding: 20, marginBottom: 28 }}>
            <ActivityAttachments
              activityId={activity.id}
              initialAttachments={activity.attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                fileUrl: a.fileUrl,
                fileSize: a.fileSize,
                uploadedByName: a.uploadedBy.name,
                createdAt: a.createdAt.toISOString(),
              }))}
              canEdit={canEdit}
            />
          </div>
        </>
      )}

      <h3 style={{ marginBottom: 14 }}>Remarks</h3>
      <div className="card w-full" style={{ padding: 20, marginBottom: 28 }}>
        <ActivityComments
          activityId={activity.id}
          comments={activity.comments}
          members={approvedMembers.map((m) => m.user)}
        />
      </div>

      {activity.history.length > 0 && (
        <>
          <h3 style={{ marginBottom: 14 }}>History</h3>
          <div className="card" style={{ padding: "6px 20px" }}>
            {activity.history.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  padding: "12px 0",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  fontSize: "0.88em",
                }}
              >
                <div>
                  <strong>{entry.changedBy?.name ?? "System"}</strong>{" "}
                  <span className="muted">
                    {entry.field === "created" ? (
                      "created this activity"
                    ) : (
                      <>
                        changed {FIELD_LABELS[entry.field] ?? entry.field} from{" "}
                        <strong>
                          {formatHistoryValue(entry.field, entry.oldValue)}
                        </strong>{" "}
                        to{" "}
                        <strong>
                          {formatHistoryValue(entry.field, entry.newValue)}
                        </strong>
                      </>
                    )}
                    {entry.source !== "app" && ` (via ${entry.source})`}
                  </span>
                </div>
                <div
                  className="muted"
                  style={{ fontSize: "0.85em", marginTop: 2 }}
                >
                  {formatDateTime(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {canDelete && (
        <div style={{ marginTop: 28 }}>
          <DeleteActivityButton activityId={activity.id} trackerId={trackerId} />
        </div>
      )}
    </div>
  );
}
