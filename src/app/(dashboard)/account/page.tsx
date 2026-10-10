import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { BackLink } from "@/components/BackLink";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function AccountPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { globalRoles: { include: { role: true } } },
  });
  if (!user) redirect("/sign-in");

  const signInMethod = user.passwordHash ? "Email and password" : "Google";

  return (
    <div style={{ maxWidth: 560 }}>
      <BackLink href="/trackers" label="Trackers" />
      <h1 style={{ marginBottom: 24 }}>Account</h1>

      <div className="card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <span className="avatar" style={{ width: 56, height: 56, fontSize: "1.1rem" }}>
          {initials(user.name) || "?"}
        </span>
        <div>
          <div style={{ fontWeight: 650, fontSize: "1.05rem" }}>{user.name}</div>
          <div className="muted" style={{ fontSize: "0.9em" }}>
            {user.email}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row label="Sign-in method" value={signInMethod} />
        <Row label="Member since" value={user.createdAt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} />
        <Row
          label="Global roles"
          value={
            user.globalRoles.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {user.globalRoles.map((ur) => (
                  <span key={ur.id} className="badge badge-primary">
                    {ur.role.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="muted">None</span>
            )
          }
        />
      </div>

      <p className="muted" style={{ fontSize: "0.85em", marginTop: 16 }}>
        Per-tracker roles (Owner, Admin, Contributor, etc.) are shown on each tracker&apos;s own Members page.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <span className="muted" style={{ fontSize: "0.9em" }}>
        {label}
      </span>
      <span style={{ fontWeight: 560 }}>{value}</span>
    </div>
  );
}
