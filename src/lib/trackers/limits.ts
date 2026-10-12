import { getGlobalGrants } from "@/lib/rbac/permissions";

/** Whoever approves everyone else's tracker-limit requests has no one to ask themselves — exempt from the cap entirely. */
export async function hasUnlimitedTrackers(userId: string): Promise<boolean> {
  const grants = await getGlobalGrants(userId);
  return grants.has("users:MANAGE");
}
