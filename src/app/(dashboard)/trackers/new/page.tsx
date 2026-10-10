import { prisma } from "@/lib/db";
import { NewTrackerForm } from "@/components/trackers/NewTrackerForm";
import { BackLink } from "@/components/BackLink";

export default async function NewTrackerPage() {
  const systems = await prisma.system.findMany({ orderBy: { name: "asc" } });

  return (
    <div style={{ maxWidth: 560 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>New tracker</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        You become the Owner. Link it to one or more systems from the directory.
      </p>
      <NewTrackerForm systems={systems.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
