"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function TrackerSettingsEditor({
  trackerId,
  name: initialName,
  description: initialDescription,
  visibility: initialVisibility,
  canEdit,
}: {
  trackerId: string;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [visibility, setVisibility] = useState(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/trackers/${trackerId}`, { name, description: description || null, visibility });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.85em" }} onClick={() => setEditing(true)}>
        Edit tracker
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
      <div>
        <label className="field-label">Name</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="field-label">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="field-label">Visibility</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["PRIVATE", "PUBLIC"] as const).map((v) => (
            <label key={v} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.9em" }}>
              <input type="radio" checked={visibility === v} onChange={() => setVisibility(v)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>{v === "PRIVATE" ? "Private — invite only" : "Public — anyone can request to join"}</span>
            </label>
          ))}
        </div>
      </div>
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
