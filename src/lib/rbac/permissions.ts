import { prisma } from "@/lib/db";
import type { PermissionAction } from "@prisma/client";

/** A grant is "<menu.key>:<ACTION>", e.g. "tracker.activities:EDIT". */
export type GrantKey = `${string}:${PermissionAction}`;

function grantKey(menuKey: string, action: PermissionAction): GrantKey {
  return `${menuKey}:${action}` as GrantKey;
}

/** The caller's GLOBAL-scope grants, from every Role in their UserRole rows. */
export async function getGlobalGrants(userId: string): Promise<Set<GrantKey>> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: { permissions: { include: { permission: { include: { menu: true } } } } },
      },
    },
  });

  const grants = new Set<GrantKey>();
  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      const { menu, action } = rolePermission.permission;
      grants.add(grantKey(menu.key, action));
    }
  }
  return grants;
}

/** The caller's TRACKER-scope grants for one tracker, from their approved TrackerMembership's role. */
export async function getTrackerGrants(userId: string, trackerId: string): Promise<Set<GrantKey>> {
  const membership = await prisma.trackerMembership.findUnique({
    where: { trackerId_userId: { trackerId, userId } },
    include: {
      role: {
        include: { permissions: { include: { permission: { include: { menu: true } } } } },
      },
    },
  });

  const grants = new Set<GrantKey>();
  if (!membership || membership.status !== "APPROVED") return grants;

  for (const rolePermission of membership.role.permissions) {
    const { menu, action } = rolePermission.permission;
    grants.add(grantKey(menu.key, action));
  }
  return grants;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export async function requireGlobalGrant(
  userId: string,
  menuKey: string,
  action: PermissionAction
): Promise<void> {
  const grants = await getGlobalGrants(userId);
  if (!grants.has(grantKey(menuKey, action))) throw new ForbiddenError();
}

export async function requireTrackerGrant(
  userId: string,
  trackerId: string,
  menuKey: string,
  action: PermissionAction
): Promise<void> {
  const grants = await getTrackerGrants(userId, trackerId);
  if (!grants.has(grantKey(menuKey, action))) throw new ForbiddenError();
}
