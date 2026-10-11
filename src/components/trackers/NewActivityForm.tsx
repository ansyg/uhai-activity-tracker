"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface ModuleOption {
  id: string;
  name: string;
}

interface CreatedActivity {
  id: string;
  title: string;
  description: string | null;
  statusPercent: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  phaseId: string;
}

export function NewActivityForm({
  trackerId,
  phaseId,
  modules,
  onCreated,
}: {
  trackerId: string;
  phaseId: string;
  modules: ModuleOption[];
  onCreated?: (activity: CreatedActivity & { module: ModuleOption | null; assignees: []; commentCount: number }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { activity } = await api.post<{ activity: CreatedActivity }>(`/api/trackers/${trackerId}/activities`, {
        phaseId,
        title,
        description: description || undefined,
        moduleId: moduleId || undefined,
      });
      setTitle("");
      setDescription("");
      setModuleId("");
      setOpen(false);
      if (onCreated) {
        onCreated({
          ...activity,
          module: modules.find((m) => m.id === moduleId) ?? null,
          assignees: [],
          commentCount: 0,
        });
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that activity.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }} onClick={() => setOpen(true)}>
        + Add activity
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        className="input"
        placeholder="Activity title"
        autoFocus
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input"
        placeholder="Description (optional)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {modules.length > 0 && (
        <select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          <option value="">No module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add activity"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}
