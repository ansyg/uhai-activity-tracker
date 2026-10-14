"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function ModuleChip({
  systemId,
  moduleId,
  name: initialName,
  canEdit,
}: {
  systemId: string;
  moduleId: string;
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/systems/${systemId}/modules/${moduleId}`, { name: name.trim() });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename that module.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/systems/${systemId}/modules/${moduleId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that module.");
      setBusy(false);
    }
  }

  if (!canEdit) {
    return <span className="badge badge-neutral">{initialName}</span>;
  }

  if (editing) {
    return (
      <form onSubmit={handleRename} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: 120, padding: "2px 8px", fontSize: "0.82em" }}
        />
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ padding: "2px 8px", fontSize: "0.78em" }}>
          Save
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ padding: "2px 8px", fontSize: "0.78em" }}
          onClick={() => {
            setEditing(false);
            setName(initialName);
            setError(null);
          }}
        >
          Cancel
        </button>
        {error && <span className="error-text" style={{ fontSize: "0.78em" }}>{error}</span>}
      </form>
    );
  }

  return (
    <span className="badge badge-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Rename module"
        style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer" }}
      >
        {initialName}
      </button>
      <button
        type="button"
        onClick={handleRemove}
        disabled={busy}
        title="Remove module"
        aria-label={`Remove ${initialName}`}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
          lineHeight: 1,
          fontSize: "1.1em",
        }}
      >
        ×
      </button>
      {error && (
        <span className="error-text" style={{ fontSize: "0.78em", whiteSpace: "nowrap" }}>
          {error}
        </span>
      )}
    </span>
  );
}
