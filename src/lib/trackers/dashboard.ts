import { prisma } from "@/lib/db";

/** The tracker summary tiles + per-phase breakdown from ARCHITECTURE.md §8. Shared by the page and the API route. */
export async function computeTrackerDashboard(trackerId: string) {
  const [activities, phases] = await Promise.all([
    prisma.activity.findMany({
      where: { trackerId },
      select: {
        id: true,
        status: true,
        statusPercent: true,
        phaseId: true,
        endDate: true,
        assignees: { select: { roleTag: true, user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.phase.findMany({ where: { trackerId }, orderBy: { sequence: "asc" } }),
  ]);

  const totals = {
    total: activities.length,
    completed: activities.filter((a) => a.status === "COMPLETED").length,
    inProgress: activities.filter((a) => a.status === "IN_PROGRESS").length,
    notStarted: activities.filter((a) => a.status === "NOT_STARTED").length,
  };

  const now = new Date();
  const overdue = activities.filter((a) => a.status !== "COMPLETED" && a.endDate && a.endDate < now).length;

  const byPhase = phases.map((phase) => {
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
