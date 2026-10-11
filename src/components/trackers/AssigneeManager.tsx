"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface Assignee {
  id: string;
  roleTag: string | null;
  user: { id: string; name: string } | null;
}

interface MemberOption {
  id: string;
  name: string;
}

export function AssigneeManager({
  activityId,
  assignees: initialAssignees,
  members,
  canEdit,
  onChange,
}: {
  activityId: string;
  assignees: Assignee[];
  members: MemberOption[];
  canEdit: boolean;
  /** When provided, used instead of a full router.refresh() — lets a parent (e.g. a live-updating table row) stay in sync without a server round-trip. */
  onChange?: (assignees: Assignee[]) => void;
}) {
  const router = useRouter();
  const [assignees, setAssignees] = useState(initialAssignees);
  const [mode, setMode] = useState<"member" | "tag">("member");
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignedUserIds = new Set(assignees.map((a) => a.user?.id).filter(Boolean));
  const availableMembers = members.filter((m) => !assignedUserIds.has(m.id));

  function applyChange(next: Assignee[]) {
    setAssignees(next);
    if (onChange) onChange(next);
    else router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let created: Assignee;
      if (mode === "member") {
        if (!memberId) return;
        const result = await api.post<{ assignee: Assignee }>(`/api/activities/${activityId}/assignees`, { userId: memberId });
        created = result.assignee;
      } else {
        if (!tag.trim()) return;
        const result = await api.post<{ assignee: Assignee }>(`/api/activities/${activityId}/assignees`, { roleTag: tag.trim() });
        created = result.assignee;
        setTag("");
      }
      applyChange([...assignees, created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that assignee.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(assigneeId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/activities/${activityId}/assignees/${assigneeId}`);
      applyChange(assignees.filter((a) => a.id !== assigneeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that assignee.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: canEdit ? 12 : 0 }}>
        {assignees.length === 0 && <span className="muted">Unassigned</span>}
        {assignees.map((a) => (
          <span key={a.id} className={`badge ${a.user ? "badge-primary" : "badge-neutral"}`} style={{ gap: 6 }}>
            {a.user?.name ?? a.roleTag}
            {canEdit && (
              <button
                onClick={() => handleRemove(a.id)}
                disabled={busy}
                aria-label="Remove assignee"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="input" style={{ width: 110 }} value={mode} onChange={(e) => setMode(e.target.value as "member" | "tag")}>
            <option value="member">Member</option>
            <option value="tag">Role tag</option>
          </select>
          {mode === "member" ? (
            availableMembers.length > 0 ? (
              <select className="input" style={{ width: 180 }} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted" style={{ fontSize: "0.85em" }}>
                Everyone&apos;s already assigned
              </span>
            )
          ) : (
            <input
              className="input"
              style={{ width: 180 }}
              placeholder="e.g. Backend"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          )}
          <button className="btn" type="submit" disabled={busy || (mode === "member" && availableMembers.length === 0)}>
            Add
          </button>
          {error && <span className="error-text">{error}</span>}
        </form>
      )}
    </div>
  );
}
