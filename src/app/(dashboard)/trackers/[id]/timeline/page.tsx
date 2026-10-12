import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { BackLink } from "@/components/BackLink";
import { TrackerTimeline } from "@/components/trackers/TrackerTimeline";

export default async function TrackerTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const { id: trackerId } = await params;

  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    select: { id: true, name: true, ownerId: true, visibility: true },
  });
  if (!tracker) notFound();

  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId } },
  });
  const isOwner = tracker.ownerId === userId;
  const isApprovedMember = membership?.status === "APPROVED";
  if (tracker.visibility === "PRIVATE" && !isOwner && !isApprovedMember) notFound();

  const phases = await prisma.phase.findMany({
    where: { trackerId },
    orderBy: { sequence: "asc" },
    include: {
      activities: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, startDate: true, endDate: true, status: true, statusPercent: true },
      },
    },
  });

  const scheduled = phases.flatMap((phase) =>
    phase.activities
      .filter((activity) => activity.startDate && activity.endDate)
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        phaseId: phase.id,
        phaseName: phase.name,
        startDate: activity.startDate!.toISOString(),
        endDate: activity.endDate!.toISOString(),
        status: activity.status,
        statusPercent: activity.statusPercent,
      }))
  );

  const unscheduledCount = phases.reduce(
    (sum, phase) => sum + phase.activities.filter((activity) => !activity.startDate || !activity.endDate).length,
    0
  );

  return (
    <div>
      <BackLink href={`/trackers/${trackerId}`} label={tracker.name} />
      <h1 style={{ margin: "0 0 6px" }}>Timeline</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Every activity with both a start and end date, laid out across the project.
      </p>

      <TrackerTimeline trackerId={trackerId} activities={scheduled} />

      {unscheduledCount > 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: "0.85em" }}>
          {unscheduledCount} {unscheduledCount === 1 ? "activity isn't" : "activities aren't"} shown here — give{" "}
          {unscheduledCount === 1 ? "it" : "them"} a start and end date to place {unscheduledCount === 1 ? "it" : "them"} on the
          timeline.
        </p>
      )}
    </div>
  );
}
