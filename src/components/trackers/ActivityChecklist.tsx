"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

interface ChecklistItemData {
  id: string;
  text: string;
  done: boolean;
}

export function ActivityChecklist({
  activityId,
  initialItems,
  canEdit,
}: {
  activityId: string;
  initialItems: ChecklistItemData[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function toggleDone(item: ChecklistItemData) {
    setBusyId(item.id);
    setError(null);
    const nextDone = !item.done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: nextDone } : i)));
    try {
      await api.patch(`/api/activities/${activityId}/checklist/${item.id}`, { done: nextDone });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      setError(err instanceof ApiError ? err.message : "Couldn't update that item.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyId(itemId);
    setError(null);
    try {
      await api.delete(`/api/activities/${activityId}/checklist/${itemId}`);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that item.");
    } finally {
      setBusyId(null);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const data = await api.post<{ item: ChecklistItemData }>(`/api/activities/${activityId}/checklist`, {
        text: text.trim(),
      });
      setItems((prev) => [...prev, data.item]);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that item.");
    } finally {
      setAdding(false);
    }
  }

  if (items.length === 0 && !canEdit) return null;

  return (
    <div>
      {items.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div className="progress-track" style={{ flex: 1, maxWidth: 200 }}>
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <span className="muted" style={{ fontSize: "0.82em" }}>
              {doneCount} of {items.length} done
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!canEdit || busyId === item.id}
                  onChange={() => toggleDone(item)}
                />
                <span
                  style={{
                    fontSize: "0.9em",
                    flex: 1,
                    textDecoration: item.done ? "line-through" : "none",
                    color: item.done ? "var(--ink-muted)" : "var(--ink)",
                  }}
                >
                  {item.text}
                </span>
                {canEdit && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    style={{ padding: "2px 6px", fontSize: "0.75em" }}
                    disabled={busyId === item.id}
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <form onSubmit={addItem} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Add a checklist item…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1, fontSize: "0.88em", padding: "6px 10px" }}
            disabled={adding}
          />
          <button className="btn" type="submit" disabled={adding || !text.trim()} style={{ fontSize: "0.85em", padding: "6px 14px" }}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ fontSize: "0.85em", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
