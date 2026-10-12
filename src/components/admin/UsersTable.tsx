"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { DataTable, type Column } from "@/components/ui/DataTable";

interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  subscriptionStatus: "PENDING" | "APPROVED" | "REJECTED";
  maxTrackers: number;
  ownedTrackerCount: number;
  createdAt: string;
  signInMethod: string;
  globalRoles: string[];
  trackers: { id: string; name: string }[];
  /** Tracker names with a PENDING invite out to this email — approving seats them in automatically. */
  pendingInviteTrackers: string[];
}

interface LimitRequestRow {
  id: string;
  requestedMax: number;
  reason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; maxTrackers: number };
}

interface RoleOption {
  id: string;
  name: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const SUBSCRIPTION_BADGE: Record<UserRow["subscriptionStatus"], string> = {
  PENDING: "badge-not-started",
  APPROVED: "badge-completed",
  REJECTED: "badge-danger",
};

/** A password-based account's name is ours to edit; a Google account's name comes from its Google identity. */
function NameCell({
  user,
  canEdit,
  currentUserId,
  onSaved,
}: {
  user: UserRow;
  canEdit: boolean;
  currentUserId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/users/${user.id}`, { name: trimmed });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem", flexShrink: 0 }}>
          {initials(name) || "?"}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <input
            className="input"
            style={{ padding: "4px 8px", fontSize: "0.9em", width: 170 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-primary" style={{ padding: "2px 10px", fontSize: "0.78em" }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: "2px 10px", fontSize: "0.78em" }}
              onClick={() => {
                setEditing(false);
                setName(user.name);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
          {error && <span className="error-text" style={{ fontSize: "0.76em" }}>{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem", flexShrink: 0 }}>
        {initials(user.name) || "?"}
      </span>
      <div>
        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          {user.name}
          {user.id === currentUserId && <span className="muted" style={{ fontSize: "0.78em" }}>(you)</span>}
          {canEdit && (
            <button
              className="btn btn-ghost"
              style={{ padding: "0 4px", fontSize: "0.76em" }}
              onClick={() => setEditing(true)}
              title="Edit name"
            >
              Edit
            </button>
          )}
        </div>
        <div className="muted" style={{ fontSize: "0.85em" }}>
          {user.email}
        </div>
      </div>
    </div>
  );
}

/** Read-only tracker badges plus an editable set of global roles (e.g. "Platform Admin") — the only slot UserRole ever fills. */
function GlobalRolesCell({
  user,
  canManage,
  options,
  onChanged,
}: {
  user: UserRow;
  canManage: boolean;
  options: RoleOption[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = options.filter((o) => !user.globalRoles.includes(o.name));

  async function addRole() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/users/${user.id}/roles`, { roleId: selected });
      setAdding(false);
      setSelected("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that role.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(roleName: string) {
    const role = options.find((o) => o.name === roleName);
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/users/${user.id}/roles/${role.id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {user.globalRoles.map((role) => (
          <span key={role} className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {role}
            {canManage && (
              <button
                onClick={() => removeRole(role)}
                disabled={busy}
                title={`Remove ${role}`}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "0.95em" }}
              >
                ×
              </button>
            )}
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
      {canManage &&
        (adding ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ fontSize: "0.8em", padding: "3px 6px", width: "auto" }}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              <option value="">Add role…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" style={{ padding: "2px 10px", fontSize: "0.78em" }} onClick={addRole} disabled={busy || !selected}>
              Add
            </button>
            <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: "0.78em" }} onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        ) : (
          available.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ padding: "2px 0", fontSize: "0.78em", alignSelf: "flex-start" }}
              onClick={() => setAdding(true)}
            >
              + Add global role
            </button>
          )
        ))}
      {error && <span className="error-text" style={{ fontSize: "0.76em" }}>{error}</span>}
    </div>
  );
}

function LimitRequests({ requests, onDecided }: { requests: LimitRequestRow[]; onDecided: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/api/tracker-limit-requests/${id}`, { decision });
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't decide that request.");
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ marginBottom: 12 }}>Tracker limit requests</h3>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {r.user.name} <span className="muted" style={{ fontWeight: 400 }}>({r.user.email})</span>
              </div>
              <div className="muted" style={{ fontSize: "0.85em" }}>
                Wants {r.requestedMax} trackers (currently {r.user.maxTrackers}){r.reason ? ` — "${r.reason}"` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => decide(r.id, "APPROVE")}>
                {busyId === r.id ? "Saving…" : "Approve"}
              </button>
              <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => decide(r.id, "REJECT")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsersTable({
  users,
  canManage,
  currentUserId,
  limitRequests,
  globalRoleOptions,
}: {
  users: UserRow[];
  canManage: boolean;
  currentUserId: string;
  limitRequests: LimitRequestRow[];
  globalRoleOptions: RoleOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetSentId, setResetSentId] = useState<string | null>(null);

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

  async function decideSubscription(user: UserRow, subscriptionStatus: "APPROVED" | "REJECTED") {
    setBusyId(user.id);
    setError(null);
    try {
      await api.patch(`/api/users/${user.id}`, { subscriptionStatus });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that user.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendPasswordReset(user: UserRow) {
    setBusyId(user.id);
    setError(null);
    try {
      await api.post(`/api/users/${user.id}/send-password-reset`, {});
      setResetSentId(user.id);
      setTimeout(() => setResetSentId((id) => (id === user.id ? null : id)), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a reset link.");
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

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (user) => (
        <NameCell
          user={user}
          canEdit={canManage && user.signInMethod === "Email and password"}
          currentUserId={currentUserId}
          onSaved={() => router.refresh()}
        />
      ),
    },
    {
      key: "roles",
      header: "Roles & trackers",
      width: 280,
      cell: (user) => (
        <GlobalRolesCell
          user={user}
          canManage={canManage && user.id !== currentUserId}
          options={globalRoleOptions}
          onChanged={() => router.refresh()}
        />
      ),
    },
    {
      key: "signInMethod",
      header: "Sign-in",
      sortable: true,
      width: 180,
      cell: (user) => (
        <div className="muted" style={{ fontSize: "0.85em" }}>
          {user.signInMethod}
          <div style={{ marginTop: 2 }}>
            {user.ownedTrackerCount}/{user.maxTrackers} trackers owned
          </div>
        </div>
      ),
    },
    {
      key: "subscriptionStatus",
      header: "Subscription",
      sortable: true,
      width: 180,
      cell: (user) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <span className={`badge ${SUBSCRIPTION_BADGE[user.subscriptionStatus]}`}>
            {user.subscriptionStatus === "PENDING" ? "Approval pending" : user.subscriptionStatus === "APPROVED" ? "Approved" : "Rejected"}
          </span>
          {user.subscriptionStatus === "PENDING" && user.pendingInviteTrackers.length > 0 && (
            <span
              className="badge badge-primary"
              style={{ fontSize: "0.76em" }}
              title={`Approving will also add them to: ${user.pendingInviteTrackers.join(", ")}`}
            >
              Invited to {user.pendingInviteTrackers.length} tracker{user.pendingInviteTrackers.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      sortable: true,
      width: 120,
      cell: (user) => (
        <span className={`badge ${user.isActive ? "badge-completed" : "badge-danger"}`}>{user.isActive ? "Active" : "Deactivated"}</span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn" onClick={copySignUpLink}>
          {copied ? "Copied!" : "Copy sign-up link to invite someone"}
        </button>
      </div>

      {canManage && <LimitRequests requests={limitRequests} onDecided={() => router.refresh()} />}

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

      <DataTable
        columns={columns}
        data={users}
        rowKey={(user) => user.id}
        getSearchText={(user) => `${user.name} ${user.email} ${user.signInMethod} ${user.globalRoles.join(" ")}`}
        searchable
        searchPlaceholder="Search users…"
        minWidth={960}
        emptyTitle="No users yet"
        actions={
          canManage
            ? (user) => (
                <>
                  {user.subscriptionStatus === "PENDING" && (
                    <>
                      <button className="btn btn-primary" disabled={busyId === user.id} onClick={() => decideSubscription(user, "APPROVED")}>
                        {busyId === user.id ? "Saving…" : "Approve"}
                      </button>
                      <button className="btn btn-danger" disabled={busyId === user.id} onClick={() => decideSubscription(user, "REJECTED")}>
                        Reject
                      </button>
                    </>
                  )}
                  {user.signInMethod === "Email and password" && (
                    <button className="btn" onClick={() => sendPasswordReset(user)} disabled={busyId === user.id}>
                      {busyId === user.id ? "Sending…" : resetSentId === user.id ? "Reset link sent!" : "Send password reset"}
                    </button>
                  )}
                  {user.id !== currentUserId && (
                    <button
                      className={user.isActive ? "btn btn-danger" : "btn"}
                      onClick={() => toggleActive(user)}
                      disabled={busyId === user.id}
                    >
                      {busyId === user.id ? "Saving…" : user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </>
              )
            : undefined
        }
      />
    </div>
  );
}
