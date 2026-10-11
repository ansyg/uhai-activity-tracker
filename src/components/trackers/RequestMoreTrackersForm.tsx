"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

export function RequestMoreTrackersForm({ currentMax }: { currentMax: number }) {
  const [requestedMax, setRequestedMax] = useState(currentMax + 2);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/tracker-limit-requests", { requestedMax, reason: reason || undefined });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="muted" style={{ fontSize: "0.9em" }}>
        Request sent — the platform owner will review it.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="field-label">New limit you&apos;re requesting</label>
        <input
          className="input"
          type="number"
          min={currentMax + 1}
          required
          value={requestedMax}
          onChange={(e) => setRequestedMax(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="field-label">Reason (optional)</label>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
