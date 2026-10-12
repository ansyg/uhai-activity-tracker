"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api/client";

type SystemRole = "SOURCE" | "TARGET" | "PARTICIPANT";

interface SystemOption {
  id: string;
  name: string;
}

interface LinkedSystem {
  system: SystemOption;
  role: SystemRole;
}

const ROLE_LABEL: Record<SystemRole, string> = {
  SOURCE: "Source",
  TARGET: "Target",
  PARTICIPANT: "Participant",
};

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: SystemRole;
  onChange: (role: SystemRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="input"
      style={{ padding: "2px 6px", fontSize: "0.85em", width: "auto" }}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SystemRole)}
    >
      {(["SOURCE", "TARGET", "PARTICIPANT"] as const).map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );
}

export function TrackerSystemsEditor({
  trackerId,
  initialSystems,
  canEdit,
}: {
  trackerId: string;
  initialSystems: LinkedSystem[];
  canEdit: boolean;
}) {
  const [systems, setSystems] = useState(initialSystems);
  const [editing, setEditing] = useState(false);
  const [busySystemId, setBusySystemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<SystemOption[] | null>(null);
  const [addSystemId, setAddSystemId] = useState("");
  const [addRole, setAddRole] = useState<SystemRole>("PARTICIPANT");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!editing || options !== null) return;
    api
      .get<{ systems: SystemOption[] }>("/api/systems")
      .then((data) => setOptions(data.systems))
      .catch(() => setOptions([]));
  }, [editing, options]);

  const linkedIds = useMemo(() => new Set(systems.map((s) => s.system.id)), [systems]);
  const availableOptions = useMemo(
    () => (options ?? []).filter((o) => !linkedIds.has(o.id)),
    [options, linkedIds]
  );

  async function handleRoleChange(systemId: string, role: SystemRole) {
    setBusySystemId(systemId);
    setError(null);
    try {
      await api.patch(`/api/trackers/${trackerId}/systems/${systemId}`, { role });
      setSystems((prev) => prev.map((link) => (link.system.id === systemId ? { ...link, role } : link)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change that system's role.");
    } finally {
      setBusySystemId(null);
    }
  }

  async function handleRemove(systemId: string) {
    setBusySystemId(systemId);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}/systems/${systemId}`);
      setSystems((prev) => prev.filter((link) => link.system.id !== systemId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that system.");
    } finally {
      setBusySystemId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addSystemId) return;
    setAdding(true);
    setError(null);
    try {
      const data = await api.post<{ link: LinkedSystem }>(`/api/trackers/${trackerId}/systems`, {
        systemId: addSystemId,
        role: addRole,
      });
      setSystems((prev) => [...prev, data.link]);
      setAddSystemId("");
      setAddRole("PARTICIPANT");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't link that system.");
    } finally {
      setAdding(false);
    }
  }

  if (!canEdit) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {systems.map((link) => (
          <span key={link.system.id} style={{ display: "inline-flex", gap: 4 }}>
            <span className="badge badge-neutral">{link.system.name}</span>
            <span className="badge badge-neutral" style={{ opacity: 0.7 }}>
              {ROLE_LABEL[link.role].toLowerCase()}
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {systems.map((link) => (
          <span key={link.system.id} style={{ display: "inline-flex", gap: 4 }}>
            <span className="badge badge-neutral">{link.system.name}</span>
            <span className="badge badge-neutral" style={{ opacity: 0.7 }}>
              {ROLE_LABEL[link.role].toLowerCase()}
            </span>
          </span>
        ))}
        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.85em" }} onClick={() => setEditing(true)}>
          Edit systems
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 14, maxWidth: 480 }}>
      <label className="field-label">Systems involved</label>

      {systems.length === 0 && <p className="muted" style={{ fontSize: "0.85em" }}>No systems linked yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {systems.map((link) => (
          <div
            key={link.system.id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}
          >
            <span style={{ fontSize: "0.9em", fontWeight: 500 }}>{link.system.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <RoleSelect
                value={link.role}
                disabled={busySystemId === link.system.id}
                onChange={(role) => handleRoleChange(link.system.id, role)}
              />
              <button
                className="btn btn-ghost"
                type="button"
                style={{ padding: "2px 8px", fontSize: "0.8em" }}
                disabled={busySystemId === link.system.id}
                onClick={() => handleRemove(link.system.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          value={addSystemId}
          onChange={(e) => setAddSystemId(e.target.value)}
        >
          <option value="">
            {options === null ? "Loading systems…" : availableOptions.length === 0 ? "No more systems to add" : "Add a system…"}
          </option>
          {availableOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <RoleSelect value={addRole} onChange={setAddRole} />
        <button className="btn btn-primary" type="submit" disabled={!addSystemId || adding} style={{ padding: "4px 12px", fontSize: "0.85em" }}>
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
