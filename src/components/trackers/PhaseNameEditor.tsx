"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function PhaseNameEditor({
  trackerId,
  phaseId,
  name: initialName,
  canEdit,
  onRenamed,
}: {
  trackerId: string;
  phaseId: string;
  name: string;
  canEdit: boolean;
  onRenamed?: (name: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/trackers/${trackerId}/phases/${phaseId}`, { name: name.trim() });
      setEditing(false);
      if (onRenamed) onRenamed(name.trim());
      else router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename that phase.");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return <h4 style={{ fontSize: "0.98em" }}>{initialName}</h4>;

  if (!editing) {
    return (
      <button
        className="btn btn-ghost"
        style={{ padding: "2px 0", fontSize: "0.98em", fontWeight: 650 }}
        onClick={() => setEditing(true)}
        title="Rename phase"
      >
        {initialName}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        className="input"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: 220, padding: "4px 8px", fontSize: "0.9em" }}
      />
      <button className="btn btn-primary" type="submit" disabled={saving} style={{ fontSize: "0.82em", padding: "4px 10px" }}>
        Save
      </button>
      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => {
          setEditing(false);
          setName(initialName);
        }}
        style={{ fontSize: "0.82em", padding: "4px 10px" }}
      >
        Cancel
      </button>
      {error && <span className="error-text" style={{ fontSize: "0.82em" }}>{error}</span>}
    </form>
  );
}
