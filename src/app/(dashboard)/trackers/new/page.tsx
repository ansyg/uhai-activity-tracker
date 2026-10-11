import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { NewTrackerForm } from "@/components/trackers/NewTrackerForm";
import { RequestMoreTrackersForm } from "@/components/trackers/RequestMoreTrackersForm";
import { BackLink } from "@/components/BackLink";

export default async function NewTrackerPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const [user, ownedCount, systems] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { subscriptionStatus: true, maxTrackers: true } }),
    prisma.tracker.count({ where: { ownerId: userId } }),
    prisma.system.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div style={{ maxWidth: 560 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>New tracker</h1>

      {user.subscriptionStatus !== "APPROVED" ? (
        <p className="muted" style={{ marginBottom: 24 }}>
          {user.subscriptionStatus === "PENDING"
            ? "Your account is awaiting approval from a platform admin before you can create a tracker."
            : "Your account request was declined, so you can't create a tracker. Contact the platform owner if you think this is a mistake."}
        </p>
      ) : ownedCount >= user.maxTrackers ? (
        <>
          <p className="muted" style={{ marginBottom: 20 }}>
            You own {ownedCount} of your {user.maxTrackers} allowed trackers. Ask the platform owner for a higher
            limit to create more.
          </p>
          <RequestMoreTrackersForm currentMax={user.maxTrackers} />
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 24 }}>
            You become the Owner. Link it to one or more systems from the directory.
          </p>
          <NewTrackerForm systems={systems.map((s) => ({ id: s.id, name: s.name }))} />
        </>
      )}
    </div>
  );
}
