"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function DeletePhaseButton({
  trackerId,
  phaseId,
  onDeleted,
}: {
  trackerId: string;
  phaseId: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}/phases/${phaseId}`);
      if (onDeleted) onDeleted();
      else router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that phase.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "4px 10px" }} onClick={() => setConfirming(true)}>
        Delete phase
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {error && <span className="error-text" style={{ fontSize: "0.82em" }}>{error}</span>}
      <span className="muted" style={{ fontSize: "0.82em" }}>
        Delete this empty phase?
      </span>
      <button className="btn btn-danger" style={{ fontSize: "0.82em", padding: "4px 10px" }} onClick={handleDelete} disabled={busy}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "4px 10px" }} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </div>
  );
}
