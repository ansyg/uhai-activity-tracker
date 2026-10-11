import { prisma } from "@/lib/db";
import { computeTrackerDashboard } from "./dashboard";

/** The data shared by the on-screen report, the Excel export, and the PDF export. */
export async function loadTrackerReportData(trackerId: string) {
  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    include: { owner: { select: { name: true, email: true } }, systems: { include: { system: true } } },
  });
  if (!tracker) return null;

  const [dashboard, phases, members] = await Promise.all([
    computeTrackerDashboard(trackerId),
    prisma.phase.findMany({
      where: { trackerId },
      orderBy: { sequence: "asc" },
      include: {
        activities: {
          orderBy: { createdAt: "asc" },
          include: {
            module: { select: { name: true } },
            assignees: { include: { user: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.trackerMembership.findMany({
      where: { trackerId, status: "APPROVED" },
      include: { user: { select: { name: true, email: true } }, role: { select: { name: true } } },
      orderBy: { requestedAt: "asc" },
    }),
  ]);

  return { tracker, dashboard, phases, members };
}

export type TrackerReportData = NonNullable<Awaited<ReturnType<typeof loadTrackerReportData>>>;
