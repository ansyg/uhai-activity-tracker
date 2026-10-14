"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function SystemEditor({
  systemId,
  name: initialName,
  description: initialDescription,
  canEdit,
  canDelete,
}: {
  systemId: string;
  name: string;
  description: string | null;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/systems/${systemId}`, { name, description: description || null });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/systems/${systemId}`);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete this system.");
      setDeleting(false);
    }
  }

  if (!canEdit && !canDelete) return null;

  if (editing) {
    return (
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} style={{ fontWeight: 650 }} />
        <textarea
          className="input"
          rows={2}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ fontSize: "0.9em" }}
        />
        {error && <p className="error-text" style={{ fontSize: "0.85em" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ fontSize: "0.85em", padding: "4px 12px" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ fontSize: "0.85em", padding: "4px 12px" }}
            onClick={() => {
              setEditing(false);
              setName(initialName);
              setDescription(initialDescription ?? "");
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {canEdit && (
        <button className="btn btn-ghost" type="button" style={{ padding: "2px 8px", fontSize: "0.82em" }} onClick={() => setEditing(true)}>
          Edit
        </button>
      )}
      {canDelete && (confirmingDelete ? (
        <>
          {deleteError && <span className="error-text" style={{ fontSize: "0.82em" }}>{deleteError}</span>}
          <span className="muted" style={{ fontSize: "0.82em" }}>
            Delete this system?
          </span>
          <button
            className="btn btn-danger"
            type="button"
            style={{ padding: "2px 10px", fontSize: "0.82em" }}
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ padding: "2px 8px", fontSize: "0.82em" }}
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          className="btn btn-ghost"
          type="button"
          style={{ padding: "2px 8px", fontSize: "0.82em" }}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      ))}
    </div>
  );
}
