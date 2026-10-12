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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const SUBSCRIPTION_BADGE: Record<UserRow["subscriptionStatus"], string> = {
  PENDING: "badge-not-started",
  APPROVED: "badge-completed",
  REJECTED: "badge-danger",
};

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
}: {
  users: UserRow[];
  canManage: boolean;
  currentUserId: string;
  limitRequests: LimitRequestRow[];
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem", flexShrink: 0 }}>
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
      ),
    },
    {
      key: "roles",
      header: "Roles & trackers",
      width: 280,
      cell: (user) => (
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
