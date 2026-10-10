"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface MenuOption {
  key: string;
  label: string;
  permissions: { id: string; action: string }[];
}

export function NewRoleForm({ menus }: { menus: MenuOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setPermissionIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/roles", { name, permissionIds });
      setName("");
      setPermissionIds([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        className="input"
        placeholder="Role name (e.g. QA Lead)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {menus.map((menu) => (
          <div key={menu.key}>
            <div className="muted" style={{ fontSize: "0.82em", marginBottom: 4 }}>
              {menu.label}
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
      <button className="btn btn-primary" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
        {submitting ? "Creating…" : "Create role"}
      </button>
    </form>
  );
}
