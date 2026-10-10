import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { NewRoleForm } from "@/components/admin/NewRoleForm";
import { BackLink } from "@/components/BackLink";

export default async function RolesPermissionsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const grants = await getGlobalGrants(userId);
  if (!grants.has("roles_permissions:VIEW")) notFound();

  const [roles, menus] = await Promise.all([
    prisma.role.findMany({
      include: { permissions: { include: { permission: { include: { menu: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.menu.findMany({ include: { permissions: true }, orderBy: [{ scope: "asc" }, { order: "asc" }] }),
  ]);

  const canManage = grants.has("roles_permissions:MANAGE");

  return (
    <div style={{ maxWidth: 820 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>Roles & permissions</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Each role bundles together what it can see and do. Built-in roles are marked &quot;system&quot; and
        keep their name, but you can still adjust what they grant.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
        {roles.map((role) => (
          <div key={role.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <strong>{role.name}</strong>
              {role.isSystem && <span className="muted" style={{ fontSize: "0.78em" }}>system</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {role.permissions.length === 0 && <span className="muted" style={{ fontSize: "0.85em" }}>No grants.</span>}
              {role.permissions.map((rp) => (
                <span key={rp.permissionId} className="badge badge-primary" style={{ fontSize: "0.72em" }}>
                  {rp.permission.menu.key}:{rp.permission.action}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <h3 style={{ marginBottom: 12 }}>New custom role</h3>
          <NewRoleForm
            menus={menus.map((menu) => ({
              key: menu.key,
              label: menu.label,
              permissions: menu.permissions.map((p) => ({ id: p.id, action: p.action })),
            }))}
          />
        </>
      )}
    </div>
  );
}
