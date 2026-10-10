"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface ModuleOption {
  id: string;
  name: string;
}

export function ActivityDetailsEditor({
  activityId,
  title: initialTitle,
  description: initialDescription,
  moduleId: initialModuleId,
  modules,
  canEdit,
}: {
  activityId: string;
  title: string;
  description: string | null;
  moduleId: string | null;
  modules: ModuleOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [moduleId, setModuleId] = useState(initialModuleId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/activities/${activityId}`, {
        title,
        description: description || null,
        moduleId: moduleId || null,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit || !editing) {
    return canEdit ? (
      <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: "0.82em" }} onClick={() => setEditing(true)}>
        Edit details
      </button>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div>
        <label className="field-label">Title</label>
        <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="field-label">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {modules.length > 0 && (
        <div>
          <label className="field-label">Module</label>
          <select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">No module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
