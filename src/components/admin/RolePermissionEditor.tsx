"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface MenuOption {
  key: string;
  label: string;
  scope: "GLOBAL" | "TRACKER";
  permissions: { id: string; action: string }[];
}

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permissionId: string }[];
}

export function RolePermissionEditor({ role, menus, canManage }: { role: RoleData; menus: MenuOption[]; canManage: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [permissionIds, setPermissionIds] = useState(role.permissions.map((p) => p.permissionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPermissionIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/roles/${role.id}`, {
        name: role.isSystem ? undefined : name,
        description: description || null,
        permissionIds,
      });
      setExpanded(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this role.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${role.name}" role? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/api/roles/${role.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this role.");
      setSaving(false);
    }
  }

  const grantedCount = role.permissions.length;

  if (!expanded) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{role.name}</strong>
            {role.isSystem && <span className="muted" style={{ fontSize: "0.78em" }}>system</span>}
          </div>
          {canManage && (
            <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "4px 10px" }} onClick={() => setExpanded(true)}>
              Edit
            </button>
          )}
        </div>
        {role.description && (
          <p className="muted" style={{ fontSize: "0.85em", marginBottom: 8 }}>
            {role.description}
          </p>
        )}
        <div className="muted" style={{ fontSize: "0.85em" }}>
          {grantedCount === 0 ? "No grants." : `${grantedCount} permission${grantedCount === 1 ? "" : "s"} granted.`}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label className="field-label">Name</label>
        <input className="input" value={name} disabled={role.isSystem} onChange={(e) => setName(e.target.value)} />
        {role.isSystem && (
          <p className="muted" style={{ fontSize: "0.78em", marginTop: 4 }}>
            Built-in role names can&apos;t be changed — other flows look them up by name.
          </p>
        )}
      </div>
      <div>
        <label className="field-label">Description</label>
        <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {menus.map((menu) => (
          <div key={menu.key}>
            <div className="muted" style={{ fontSize: "0.82em", marginBottom: 4 }}>
              {menu.label} <span style={{ opacity: 0.6 }}>({menu.scope.toLowerCase()})</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {menu.permissions.map((perm) => (
                <label key={perm.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.88em" }}>
                  <input type="checkbox" checked={permissionIds.includes(perm.id)} onChange={() => toggle(perm.id)} />
                  {perm.action}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setExpanded(false)}>
            Cancel
          </button>
        </div>
        {!role.isSystem && (
          <button className="btn btn-danger" disabled={saving} onClick={handleDelete}>
            Delete role
          </button>
        )}
      </div>
    </div>
  );
}
