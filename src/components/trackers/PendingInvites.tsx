"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

export interface PendingInvite {
  id: string;
  email: string;
  roleName: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Controlled by its parent (TrackerInvites) so a just-sent invite can appear instantly, without a server round trip. */
export function PendingInvites({
  trackerId,
  invites,
  canManage,
  onRevoked,
}: {
  trackerId: string;
  invites: PendingInvite[];
  canManage: boolean;
  onRevoked: (inviteId: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}/invites/${inviteId}`);
      onRevoked(inviteId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that invite.");
    } finally {
      setBusyId(null);
    }
  }

  if (invites.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "0.9em" }}>
        No pending invites.
      </p>
    );
  }

  const now = Date.now();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {invites.map((invite) => {
        const expired = new Date(invite.expiresAt).getTime() < now;
        return (
          <div
            key={invite.id}
            className="card"
            style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{invite.email}</div>
              <div className="muted" style={{ fontSize: "0.85em" }}>
                Invited by {invite.invitedByName} on {formatDate(invite.createdAt)}
                {expired ? " — expired " : " — expires "}
                {formatDate(invite.expiresAt)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge badge-primary">{invite.roleName}</span>
              <span className={`badge ${expired ? "badge-danger" : "badge-in-progress"}`}>
                {expired ? "Expired" : "Pending"}
              </span>
              {canManage && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  style={{ padding: "4px 10px", fontSize: "0.85em" }}
                  disabled={busyId === invite.id}
                  onClick={() => revoke(invite.id)}
                >
                  {busyId === invite.id ? "Revoking…" : "Revoke"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
