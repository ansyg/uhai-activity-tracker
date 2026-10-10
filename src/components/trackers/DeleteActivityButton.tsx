"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function DeleteActivityButton({ activityId, trackerId }: { activityId: string; trackerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/activities/${activityId}`);
      router.push(`/trackers/${trackerId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that activity.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button className="btn btn-danger" onClick={() => setConfirming(true)}>
        Delete activity
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {error && <span className="error-text">{error}</span>}
      <span className="muted" style={{ fontSize: "0.9em" }}>
        Delete this activity and its history/remarks?
      </span>
      <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </div>
  );
}
