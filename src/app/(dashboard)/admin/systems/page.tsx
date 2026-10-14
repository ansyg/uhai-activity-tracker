import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { NewSystemForm } from "@/components/admin/NewSystemForm";
import { NewModuleForm } from "@/components/admin/NewModuleForm";
import { SystemEditor } from "@/components/admin/SystemEditor";
import { ModuleChip } from "@/components/admin/ModuleChip";
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
  const canDelete = grants.has("system_directory:DELETE");

  return (
    <div>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>System directory</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Systems registered here can be linked to any tracker, so each one only needs to be set up once.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        {systems.map((system) => (
          <div key={system.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3>{system.name}</h3>
                <p className="muted" style={{ fontSize: "0.88em", marginTop: 4 }}>
                  {system.description ?? "No description."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="muted" style={{ fontSize: "0.8em" }}>
                  used by {system._count.trackerLinks} tracker{system._count.trackerLinks === 1 ? "" : "s"}
                </span>
                <SystemEditor
                  systemId={system.id}
                  name={system.name}
                  description={system.description}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {system.modules.map((module) => (
                <ModuleChip key={module.id} systemId={system.id} moduleId={module.id} name={module.name} canEdit={canEdit} />
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
