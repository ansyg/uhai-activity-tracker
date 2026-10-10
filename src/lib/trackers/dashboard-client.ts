/**
 * Client-side mirror of computeTrackerDashboard (src/lib/trackers/dashboard.ts) —
 * same aggregation, but over activities already held in component state instead
 * of a fresh DB query, so progress edits can update the summary tiles and phase
 * lanes instantly without a server round-trip.
 */

export interface BoardActivity {
  id: string;
  phaseId: string;
  status: string;
  statusPercent: number;
  endDate: string | Date | null;
  assignees: { roleTag: string | null; user: { id: string; name: string } | null }[];
}

export interface BoardPhase {
  id: string;
  name: string;
  sequence: number;
}

export function computeDashboardFromActivities(activities: BoardActivity[], phases: BoardPhase[]) {
  const totals = {
    total: activities.length,
    completed: activities.filter((a) => a.status === "COMPLETED").length,
    inProgress: activities.filter((a) => a.status === "IN_PROGRESS").length,
    notStarted: activities.filter((a) => a.status === "NOT_STARTED").length,
  };

  const now = new Date();
  const overdue = activities.filter(
    (a) => a.status !== "COMPLETED" && a.endDate && new Date(a.endDate) < now
  ).length;

  const byPhase = [...phases]
    .sort((a, b) => a.sequence - b.sequence)
    .map((phase) => {
      const phaseActivities = activities.filter((a) => a.phaseId === phase.id);
      const total = phaseActivities.length;
      const avgPercent = total
        ? Math.round(phaseActivities.reduce((sum, a) => sum + a.statusPercent, 0) / total)
        : 0;

      const assigneeById = new Map<string, { id: string; name: string }>();
      const roleTags = new Set<string>();
      for (const activity of phaseActivities) {
        for (const assignee of activity.assignees) {
          if (assignee.user) assigneeById.set(assignee.user.id, assignee.user);
          else if (assignee.roleTag) roleTags.add(assignee.roleTag);
        }
      }

      return {
        phaseId: phase.id,
        name: phase.name,
        sequence: phase.sequence,
        total,
        completed: phaseActivities.filter((a) => a.status === "COMPLETED").length,
        avgPercent,
        assignees: Array.from(assigneeById.values()),
        roleTags: Array.from(roleTags),
      };
    });

  return { totals, overdue, byPhase };
}
