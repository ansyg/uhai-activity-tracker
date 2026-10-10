"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  signInMethod: string;
  globalRoles: string[];
  trackers: { id: string; name: string }[];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function UsersTable({
  users,
  canManage,
  currentUserId,
}: {
  users: UserRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function toggleActive(user: UserRow) {
    setBusyId(user.id);
    setError(null);
    try {
      await api.patch(`/api/users/${user.id}`, { isActive: !user.isActive });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that user.");
    } finally {
      setBusyId(null);
    }
  }

  function copySignUpLink() {
    navigator.clipboard.writeText(`${window.location.origin}/sign-up`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn" onClick={copySignUpLink}>
          {copied ? "Copied!" : "Copy sign-up link to invite someone"}
        </button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map((user) => (
          <div
            key={user.id}
            className="card"
            style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
              <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
                {initials(user.name) || "?"}
              </span>
              <div>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  {user.name}
                  {user.id === currentUserId && <span className="muted" style={{ fontSize: "0.78em" }}>(you)</span>}
                </div>
                <div className="muted" style={{ fontSize: "0.85em" }}>
                  {user.email}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 260 }}>
              {user.globalRoles.map((role) => (
                <span key={role} className="badge badge-primary">
                  {role}
                </span>
              ))}
              {user.trackers.length === 0 ? (
                <span className="muted" style={{ fontSize: "0.85em" }}>
                  No trackers
                </span>
              ) : (
                user.trackers.map((t) => (
                  <span key={t.id} className="badge badge-neutral">
                    {t.name}
                  </span>
                ))
              )}
            </div>

            <div className="muted" style={{ fontSize: "0.85em", minWidth: 120 }}>
              {user.signInMethod}
            </div>

            <span className={`badge ${user.isActive ? "badge-completed" : "badge-danger"}`}>
              {user.isActive ? "Active" : "Deactivated"}
            </span>

            {canManage && user.id !== currentUserId && (
              <button
                className={user.isActive ? "btn btn-danger" : "btn"}
                onClick={() => toggleActive(user)}
                disabled={busyId === user.id}
              >
                {busyId === user.id ? "Saving…" : user.isActive ? "Deactivate" : "Activate"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
