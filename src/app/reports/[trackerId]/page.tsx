import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { loadTrackerReportData } from "@/lib/trackers/report-data";
import { BRAND } from "@/lib/branding";
import { PrintButton } from "@/components/reports/PrintButton";
import { StatusBadge } from "@/components/StatusBadge";

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function TrackerReportPage({ params }: { params: Promise<{ trackerId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { trackerId } = await params;

  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId } },
  });

  const data = await loadTrackerReportData(trackerId);
  if (!data) notFound();
  const { tracker, dashboard, phases, members } = data;

  const isOwner = tracker.ownerId === userId;
  const isApprovedMember = membership?.status === "APPROVED";
  if (tracker.visibility === "PRIVATE" && !isOwner && !isApprovedMember) notFound();

  const completionPercent = dashboard.totals.total
    ? Math.round((dashboard.totals.completed / dashboard.totals.total) * 100)
    : 0;

  return (
    <div className="report-page">
      <div className="report-toolbar no-print">
        <span className="muted" style={{ fontSize: "0.88em" }}>
          This is a print-ready view, or download it as a file below.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href={`/api/trackers/${trackerId}/export/excel`}>
            Download Excel
          </a>
          <a className="btn" href={`/api/trackers/${trackerId}/export/pdf`}>
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="report-sheet">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: "0.8em", fontWeight: 700, letterSpacing: "0.04em", color: "var(--primary-strong)" }}>
              {BRAND.name}
            </div>
            <h1 style={{ fontSize: "1.6rem", marginTop: 4 }}>{tracker.name}</h1>
            <p className="muted" style={{ marginTop: 4, fontSize: "0.9em" }}>
              Progress report generated {formatDate(new Date())}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.82em" }} className="muted">
            <div>Owner: {tracker.owner.name}</div>
            {tracker.systems.length > 0 && <div>{tracker.systems.map((s) => s.system.name).join(" · ")}</div>}
          </div>
        </header>

        {tracker.description && <p style={{ marginBottom: 20, maxWidth: 640 }}>{tracker.description}</p>}

        <table className="report-table" style={{ marginBottom: 28 }}>
          <tbody>
            <tr>
              <td className="muted">Overall completion</td>
              <td style={{ fontWeight: 700, fontSize: "1.1em" }}>{completionPercent}%</td>
              <td className="muted">Completed</td>
              <td style={{ fontWeight: 700 }}>{dashboard.totals.completed}</td>
            </tr>
            <tr>
              <td className="muted">Total activities</td>
              <td style={{ fontWeight: 700 }}>{dashboard.totals.total}</td>
              <td className="muted">In progress</td>
              <td style={{ fontWeight: 700 }}>{dashboard.totals.inProgress}</td>
            </tr>
            <tr>
              <td className="muted">Overdue</td>
              <td style={{ fontWeight: 700 }}>{dashboard.overdue}</td>
              <td className="muted">Not started</td>
              <td style={{ fontWeight: 700 }}>{dashboard.totals.notStarted}</td>
            </tr>
          </tbody>
        </table>

        {members.length > 0 && (
          <>
            <h3 style={{ marginBottom: 10 }}>Team</h3>
            <table className="report-table" style={{ marginBottom: 28 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td>{m.user.name}</td>
                    <td>{m.user.email}</td>
                    <td>{m.role.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3 style={{ marginBottom: 10 }}>Progress by phase</h3>
        <table className="report-table" style={{ marginBottom: 28 }}>
          <thead>
            <tr>
              <th>Phase</th>
              <th>Completed</th>
              <th>Total</th>
              <th>% complete</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.byPhase.map((phase) => (
              <tr key={phase.phaseId}>
                <td>{phase.name}</td>
                <td>{phase.completed}</td>
                <td>{phase.total}</td>
                <td style={{ fontWeight: 650 }}>{phase.avgPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginBottom: 10 }}>Activities</h3>
        {phases.map((phase) => (
          <div key={phase.id} style={{ marginBottom: 20, breakInside: "avoid" }}>
            <h4 style={{ marginBottom: 6, fontSize: "0.95em" }}>{phase.name}</h4>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Assignees</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {phase.activities.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      {activity.title}
                      {activity.module && <div className="muted" style={{ fontSize: "0.85em" }}>{activity.module.name}</div>}
                    </td>
                    <td>
                      {activity.assignees.length === 0
                        ? "—"
                        : activity.assignees.map((a) => a.user?.name ?? a.roleTag).join(", ")}
                    </td>
                    <td>{formatDate(activity.startDate)}</td>
                    <td>{formatDate(activity.endDate)}</td>
                    <td>{activity.statusPercent}%</td>
                    <td>
                      <StatusBadge status={activity.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <footer className="muted" style={{ marginTop: 32, fontSize: "0.78em", textAlign: "center" }}>
          {BRAND.company} · {BRAND.address} · {BRAND.email}
        </footer>
      </div>
    </div>
  );
}
