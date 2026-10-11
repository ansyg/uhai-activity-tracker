"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { ICON_KEYS } from "@/lib/icon-registry";

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "MANAGE"] as const;
type Action = (typeof ACTIONS)[number];

interface MenuData {
  id: string;
  key: string;
  label: string;
  scope: "GLOBAL" | "TRACKER";
  icon: string | null;
  href: string | null;
  order: number;
  isSystem: boolean;
  permissions: { id: string; action: Action }[];
}

function MenuEditor({ menu, onDone }: { menu: MenuData; onDone: () => void }) {
  const [label, setLabel] = useState(menu.label);
  const [icon, setIcon] = useState(menu.icon ?? "");
  const [href, setHref] = useState(menu.href ?? "");
  const [order, setOrder] = useState(menu.order);
  const [actions, setActions] = useState<Action[]>(menu.permissions.map((p) => p.action));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingActions = new Set(menu.permissions.map((p) => p.action));

  function toggleAction(action: Action) {
    setActions((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/menus/${menu.id}`, {
        label,
        icon: icon || null,
        href: menu.scope === "GLOBAL" ? href || null : undefined,
        order,
        actions,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this menu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${menu.label}" menu? This removes it from every role that grants it.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/api/menus/${menu.id}`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this menu.");
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="field-label">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div style={{ width: 130 }}>
          <label className="field-label">Icon</label>
          <select className="input" value={icon} onChange={(e) => setIcon(e.target.value)}>
            <option value="">(default)</option>
            {ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 80 }}>
          <label className="field-label">Order</label>
          <input className="input" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
      </div>

      {menu.scope === "GLOBAL" && (
        <div>
          <label className="field-label">Sidebar link (href)</label>
          <input
            className="input"
            placeholder="/admin/my-feature (leave blank to keep it off the sidebar)"
            value={href}
            onChange={(e) => setHref(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="field-label">Actions</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ACTIONS.map((action) => {
            const locked = menu.isSystem && existingActions.has(action);
            return (
              <label key={action} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.88em" }}>
                <input type="checkbox" checked={actions.includes(action)} disabled={locked} onChange={() => toggleAction(action)} />
                {action}
              </label>
            );
          })}
        </div>
        {menu.isSystem && (
          <p className="muted" style={{ fontSize: "0.78em", marginTop: 4 }}>
            Built-in actions (checked, greyed out) can&apos;t be removed — the app may already check for them in code.
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
        {!menu.isSystem && (
          <button className="btn btn-danger" disabled={saving} onClick={handleDelete}>
            Delete menu
          </button>
        )}
      </div>
    </div>
  );
}

function NewMenuForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "TRACKER">("TRACKER");
  const [icon, setIcon] = useState("");
  const [href, setHref] = useState("");
  const [actions, setActions] = useState<Action[]>(["VIEW"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAction(action: Action) {
    setActions((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/menus", {
        key,
        label,
        scope,
        icon: icon || undefined,
        href: scope === "GLOBAL" ? href || undefined : undefined,
        actions,
      });
      setKey("");
      setLabel("");
      setHref("");
      setActions(["VIEW"]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that menu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="field-label">Key</label>
          <input className="input" placeholder="tracker.reports" required value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="field-label">Label</label>
          <input className="input" placeholder="Reports" required value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div style={{ width: 130 }}>
          <label className="field-label">Scope</label>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value as "GLOBAL" | "TRACKER")}>
            <option value="TRACKER">Tracker</option>
            <option value="GLOBAL">Global</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ width: 130 }}>
          <label className="field-label">Icon</label>
          <select className="input" value={icon} onChange={(e) => setIcon(e.target.value)}>
            <option value="">(default)</option>
            {ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        {scope === "GLOBAL" && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">Sidebar link (href)</label>
            <input className="input" placeholder="/admin/my-feature" value={href} onChange={(e) => setHref(e.target.value)} />
          </div>
        )}
      </div>

      <div>
        <label className="field-label">Actions</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ACTIONS.map((action) => (
            <label key={action} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.88em" }}>
              <input type="checkbox" checked={actions.includes(action)} onChange={() => toggleAction(action)} />
              {action}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
        {submitting ? "Creating…" : "Create menu"}
      </button>
    </form>
  );
}

export function MenuManager({ menus }: { menus: MenuData[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  function refresh() {
    setEditingId(null);
    setShowNewForm(false);
    router.refresh();
  }

  const global = menus.filter((m) => m.scope === "GLOBAL");
  const tracker = menus.filter((m) => m.scope === "TRACKER");

  function renderGroup(group: MenuData[], title: string) {
    return (
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 10, fontSize: "0.95em" }}>{title}</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {group.map((menu) =>
            editingId === menu.id ? (
              <MenuEditor key={menu.id} menu={menu} onDone={refresh} />
            ) : (
              <div
                key={menu.id}
                className="card"
                style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: "0.92em" }}>{menu.label}</strong>
                    <span className="muted" style={{ fontSize: "0.78em" }}>
                      {menu.key}
                    </span>
                    {menu.isSystem && <span className="muted" style={{ fontSize: "0.78em" }}>system</span>}
                  </div>
                  <div className="muted" style={{ fontSize: "0.8em", marginTop: 2 }}>
                    {menu.permissions.map((p) => p.action).join(", ") || "No actions"}
                    {menu.href && ` · ${menu.href}`}
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "4px 10px" }} onClick={() => setEditingId(menu.id)}>
                  Edit
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderGroup(global, "Global menus")}
      {renderGroup(tracker, "Tracker menus")}
      {showNewForm ? (
        <NewMenuForm onCreated={refresh} />
      ) : (
        <button className="btn" onClick={() => setShowNewForm(true)}>
          + New menu
        </button>
      )}
    </div>
  );
}
