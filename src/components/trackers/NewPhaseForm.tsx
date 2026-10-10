"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface PhaseData {
  id: string;
  name: string;
  sequence: number;
}

export function NewPhaseForm({ trackerId, onCreated }: { trackerId: string; onCreated?: (phase: PhaseData) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { phase } = await api.post<{ phase: PhaseData }>(`/api/trackers/${trackerId}/phases`, { name });
      setName("");
      setOpen(false);
      if (onCreated) onCreated(phase);
      else router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create that phase.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        + New phase
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
      <input
        className="input"
        placeholder="Phase name"
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1 }}
      />
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add"}
      </button>
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}
