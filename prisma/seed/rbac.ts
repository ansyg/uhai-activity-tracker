/**
 * Seeds the menu-based RBAC system: Menus (nav items/features) ->
 * Permissions (actions on a menu) -> Roles (named bundles of permissions).
 * Everything here is data, not code - an admin can later add a Menu,
 * tick a Permission onto a Role, or create a brand new Role from the
 * Roles & Permissions screen without a deploy. This script only seeds the
 * starting set.
 */
import { PrismaClient, MenuScope, PermissionAction } from "@prisma/client";

const prisma = new PrismaClient();

interface MenuSeed {
  key: string;
  label: string;
  scope: MenuScope;
  actions: PermissionAction[];
}

const MENUS: MenuSeed[] = [
  // Tracker-scoped: checked against the caller's TrackerMembership.role
  // for the specific tracker being accessed.
  { key: "tracker.overview", label: "Tracker Overview", scope: "TRACKER", actions: ["VIEW", "EDIT", "DELETE"] },
  {
    key: "tracker.activities",
    label: "Activities",
    scope: "TRACKER",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE"],
  },
  {
    key: "tracker.approvals",
    label: "Join Requests",
    scope: "TRACKER",
    actions: ["VIEW", "APPROVE"],
  },
  {
    key: "tracker.members",
    label: "Members & Invites",
    scope: "TRACKER",
    actions: ["VIEW", "MANAGE"],
  },
  {
    key: "tracker.calendar",
    label: "Calendar Sync Settings",
    scope: "TRACKER",
    actions: ["VIEW", "MANAGE"],
  },
  // Global: checked against the caller's UserRole(s), app-wide.
  {
    key: "system_directory",
    label: "System Directory",
    scope: "GLOBAL",
    actions: ["VIEW", "CREATE", "EDIT", "DELETE"],
  },
  {
    key: "roles_permissions",
    label: "Roles & Permissions",
    scope: "GLOBAL",
    actions: ["VIEW", "MANAGE"],
  },
  { key: "users", label: "Users", scope: "GLOBAL", actions: ["VIEW", "MANAGE"] },
];

// permission keys granted to each seeded role, as "menu.key:ACTION"
const ROLE_GRANTS: Record<string, string[]> = {
  "Platform Admin": [
    "system_directory:VIEW",
    "system_directory:CREATE",
    "system_directory:EDIT",
    "system_directory:DELETE",
    "roles_permissions:VIEW",
    "roles_permissions:MANAGE",
    "users:VIEW",
    "users:MANAGE",
  ],
  Owner: [
    "tracker.overview:VIEW",
    "tracker.overview:EDIT",
    "tracker.overview:DELETE",
    "tracker.activities:VIEW",
    "tracker.activities:CREATE",
    "tracker.activities:EDIT",
    "tracker.activities:DELETE",
    "tracker.approvals:VIEW",
    "tracker.approvals:APPROVE",
    "tracker.members:VIEW",
    "tracker.members:MANAGE",
    "tracker.calendar:VIEW",
    "tracker.calendar:MANAGE",
  ],
  Admin: [
    "tracker.overview:VIEW",
    "tracker.overview:EDIT",
    "tracker.activities:VIEW",
    "tracker.activities:CREATE",
    "tracker.activities:EDIT",
    "tracker.activities:DELETE",
    "tracker.approvals:VIEW",
    "tracker.approvals:APPROVE",
    "tracker.members:VIEW",
    "tracker.members:MANAGE",
    "tracker.calendar:VIEW",
    "tracker.calendar:MANAGE",
  ],
  Manager: [
    "tracker.overview:VIEW",
    "tracker.activities:VIEW",
    "tracker.activities:CREATE",
    "tracker.activities:EDIT",
    "tracker.activities:DELETE",
    "tracker.approvals:VIEW",
    "tracker.calendar:VIEW",
  ],
  Contributor: ["tracker.overview:VIEW", "tracker.activities:VIEW", "tracker.activities:EDIT"],
  Viewer: ["tracker.overview:VIEW", "tracker.activities:VIEW"],
};

/** Seeds menus/permissions/roles and returns { roleName -> Role.id }. */
export async function seedRbac(): Promise<Record<string, string>> {
  const permissionIdByKey = new Map<string, string>();

  for (const menu of MENUS) {
    const createdMenu = await prisma.menu.upsert({
      where: { key: menu.key },
      update: { label: menu.label, scope: menu.scope },
      create: { key: menu.key, label: menu.label, scope: menu.scope },
    });

    for (const action of menu.actions) {
      const permission = await prisma.permission.upsert({
        where: { menuId_action: { menuId: createdMenu.id, action } },
        update: {},
        create: { menuId: createdMenu.id, action },
      });
      permissionIdByKey.set(`${menu.key}:${action}`, permission.id);
    }
  }

  const roleIdByName: Record<string, string> = {};

  for (const [roleName, grantKeys] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    });
    roleIdByName[roleName] = role.id;

    for (const grantKey of grantKeys) {
      const permissionId = permissionIdByKey.get(grantKey);
      if (!permissionId) throw new Error(`Unknown permission key in seed: ${grantKey}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  return roleIdByName;
}

if (require.main === module) {
  seedRbac()
    .then((roles) => console.log("Seeded RBAC roles:", Object.keys(roles).join(", ")))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
