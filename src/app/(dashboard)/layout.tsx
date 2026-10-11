import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { getGlobalGrants } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { DashboardShell } from "@/components/DashboardShell";
import { IconHome, IconLayers, IconShield, IconUsers } from "@/components/icons";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const [user, grants] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getGlobalGrants(userId),
  ]);
  if (!user) redirect("/sign-in");

  const isPlatformAdmin = grants.has("system_directory:VIEW") || grants.has("roles_permissions:VIEW");

  const items = [
    { href: "/trackers", label: "Trackers", icon: <IconHome /> },
    ...(isPlatformAdmin ? [{ href: "/admin/systems", label: "System directory", icon: <IconLayers /> }] : []),
    ...(isPlatformAdmin ? [{ href: "/admin/roles", label: "Roles & permissions", icon: <IconShield /> }] : []),
    ...(grants.has("users:VIEW") ? [{ href: "/admin/users", label: "Users", icon: <IconUsers /> }] : []),
  ];

  return (
    <DashboardShell items={items} name={user.name} email={user.email} subscriptionStatus={user.subscriptionStatus}>
      {children}
    </DashboardShell>
  );
}
