import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { DashboardShell } from "@/components/DashboardShell";
import { IconHome } from "@/components/icons";
import { resolveIcon } from "@/lib/icon-registry";
import { isSafeHref } from "@/lib/rbac/safe-href";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const [user, grants, globalMenus] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getGlobalGrants(userId),
    // Every top-level nav item below "Trackers" comes straight from the
    // Menu table — add a GLOBAL menu with an href from the Roles &
    // Permissions screen and it shows up here for whichever roles hold
    // its :VIEW permission, with no code change.
    prisma.menu.findMany({
      where: { scope: "GLOBAL", parentId: null, href: { not: null } },
      orderBy: { order: "asc" },
    }),
  ]);
  if (!user) redirect("/sign-in");

  const items = [
    { href: "/trackers", label: "Trackers", icon: <IconHome /> },
    ...globalMenus
      .filter((menu) => grants.has(`${menu.key}:VIEW`) && isSafeHref(menu.href!))
      .map((menu) => {
        const Icon = resolveIcon(menu.icon);
        return { href: menu.href!, label: menu.label, icon: <Icon /> };
      }),
  ];

  return (
    <DashboardShell items={items} name={user.name} email={user.email} subscriptionStatus={user.subscriptionStatus}>
      {children}
    </DashboardShell>
  );
}
