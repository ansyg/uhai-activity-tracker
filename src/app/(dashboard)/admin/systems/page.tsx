import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { NewSystemForm } from "@/components/admin/NewSystemForm";
import { NewModuleForm } from "@/components/admin/NewModuleForm";
import { BackLink } from "@/components/BackLink";

export default async function SystemDirectoryPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const grants = await getGlobalGrants(userId);
  if (!grants.has("system_directory:VIEW")) notFound();

  const systems = await prisma.system.findMany({
    include: { modules: true, _count: { select: { trackerLinks: true } } },
    orderBy: { name: "asc" },
  });

  const canCreate = grants.has("system_directory:CREATE");
  const canEdit = grants.has("system_directory:EDIT");

  return (
    <div style={{ maxWidth: 760 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>System directory</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Systems registered here can be linked to any tracker, so each one only needs to be set up once.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        {systems.map((system) => (
          <div key={system.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3>{system.name}</h3>
                <p className="muted" style={{ fontSize: "0.88em", marginTop: 4 }}>
                  {system.description ?? "No description."}
                </p>
              </div>
              <span className="muted" style={{ fontSize: "0.8em" }}>
                used by {system._count.trackerLinks} tracker{system._count.trackerLinks === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {system.modules.map((module) => (
                <span key={module.id} className="badge badge-neutral">
                  {module.name}
                </span>
              ))}
            </div>
            {canEdit && (
              <div style={{ marginTop: 12 }}>
                <NewModuleForm systemId={system.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {canCreate && (
        <>
          <h3 style={{ marginBottom: 12 }}>Register a new system</h3>
          <NewSystemForm />
        </>
      )}
    </div>
  );
}
