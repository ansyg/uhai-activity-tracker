"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

interface RoleOption {
  id: string;
  name: string;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function MemberRow({
  trackerId,
  member,
  isOwner,
  canManage,
  roles,
  onRoleChanged,
  onRemoved,
}: {
  trackerId: string;
  member: Member;
  isOwner: boolean;
  canManage: boolean;
  roles: RoleOption[];
  onRoleChanged: (userId: string, roleId: string, roleName: string) => void;
  onRemoved: (userId: string) => void;
}) {
  const [savingRole, setSavingRole] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    setSavingRole(true);
    setError(null);
    try {
      await api.patch(`/api/trackers/${trackerId}/memberships/${member.userId}`, { roleId });
      onRoleChanged(member.userId, roleId, role.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change that member's role.");
    } finally {
      setSavingRole(false);
    }
  }

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}/memberships/${member.userId}`);
      onRemoved(member.userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that member.");
      setRemoving(false);
    }
  }

  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
          {initials(member.name) || "?"}
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>{member.name}</div>
          <div className="muted" style={{ fontSize: "0.85em" }}>
            {member.email}
          </div>
        </div>
      </div>

      {isOwner || !canManage ? (
        <span className="badge badge-primary">{member.roleName}</span>
      ) : confirmingRemove ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {error && <span className="error-text" style={{ fontSize: "0.82em" }}>{error}</span>}
          <span className="muted" style={{ fontSize: "0.82em" }}>
            Remove {member.name}?
          </span>
          <button
            className="btn btn-danger"
            style={{ fontSize: "0.82em", padding: "4px 10px" }}
            disabled={removing}
            onClick={remove}
          >
            {removing ? "Removing…" : "Yes, remove"}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: "0.82em", padding: "4px 10px" }}
            onClick={() => setConfirmingRemove(false)}
            disabled={removing}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {error && <span className="error-text" style={{ fontSize: "0.82em" }}>{error}</span>}
          <select
            className="input"
            style={{ width: "auto", padding: "4px 8px", fontSize: "0.85em" }}
            value={member.roleId}
            disabled={savingRole}
            onChange={(e) => changeRole(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ fontSize: "0.82em", padding: "4px 10px" }}
            onClick={() => setConfirmingRemove(true)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/** Owns the member list so a role change or removal reflects instantly, same pattern as TrackerInvites. */
export function TrackerMembers({
  trackerId,
  ownerId,
  canManage,
  roles,
  initialMembers,
}: {
  trackerId: string;
  ownerId: string;
  canManage: boolean;
  roles: RoleOption[];
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState(initialMembers);

  function handleRoleChanged(userId: string, roleId: string, roleName: string) {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, roleId, roleName } : m)));
  }

  function handleRemoved(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          trackerId={trackerId}
          member={member}
          isOwner={member.userId === ownerId}
          canManage={canManage}
          roles={roles}
          onRoleChanged={handleRoleChanged}
          onRemoved={handleRemoved}
        />
      ))}
    </div>
  );
}
