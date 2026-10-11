import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { NewRoleForm } from "@/components/admin/NewRoleForm";
import { RolePermissionEditor } from "@/components/admin/RolePermissionEditor";
import { MenuManager } from "@/components/admin/MenuManager";
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

  const menuOptions = menus.map((menu) => ({
    key: menu.key,
    label: menu.label,
    scope: menu.scope,
    permissions: menu.permissions.map((p) => ({ id: p.id, action: p.action })),
  }));

  return (
    <div>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 6 }}>Roles & permissions</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Menus are features; permissions are actions on a menu; a role bundles permissions together, and a user is
        given one or more roles. Add a menu, tick it onto a role, and it&apos;s enforceable immediately — no deploy.
      </p>

      <h3 style={{ marginBottom: 12 }}>Roles</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
        {roles.map((role) => (
          <RolePermissionEditor
            key={role.id}
            role={{
              id: role.id,
              name: role.name,
              description: role.description,
              isSystem: role.isSystem,
              permissions: role.permissions.map((rp) => ({ permissionId: rp.permissionId })),
            }}
            menus={menuOptions}
            canManage={canManage}
          />
        ))}
      </div>

      {canManage && (
        <>
          <h3 style={{ marginBottom: 12 }}>New custom role</h3>
          <div style={{ marginBottom: 32 }}>
            <NewRoleForm
              menus={menus.map((menu) => ({
                key: menu.key,
                label: menu.label,
                permissions: menu.permissions.map((p) => ({ id: p.id, action: p.action })),
              }))}
            />
          </div>

          <h3 style={{ marginBottom: 12 }}>Menus</h3>
          <MenuManager
            menus={menus.map((menu) => ({
              id: menu.id,
              key: menu.key,
              label: menu.label,
              scope: menu.scope,
              icon: menu.icon,
              href: menu.href,
              order: menu.order,
              isSystem: menu.isSystem,
              permissions: menu.permissions.map((p) => ({ id: p.id, action: p.action })),
            }))}
          />
        </>
      )}
    </div>
  );
}
