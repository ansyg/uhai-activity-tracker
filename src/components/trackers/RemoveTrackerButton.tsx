"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

/** A lighter one-click-confirm shortcut for the trackers list — the authoritative,
 * type-the-name-to-confirm flow lives in DeleteTrackerButton on the tracker's own page. */
export function RemoveTrackerButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that tracker.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {error && <span className="error-text" style={{ fontSize: "0.78em" }}>{error}</span>}
        <button className="btn btn-danger" style={{ fontSize: "0.82em", padding: "6px 10px" }} onClick={handleDelete} disabled={busy}>
          {busy ? "Removing…" : "Confirm"}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "6px 10px" }} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-ghost" style={{ fontSize: "0.82em", padding: "6px 10px" }} onClick={() => setConfirming(true)}>
      Remove
    </button>
  );
}
