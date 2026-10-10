"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function DeleteTrackerButton({ trackerId, trackerName }: { trackerId: string; trackerName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/trackers/${trackerId}`);
      router.push("/trackers");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that tracker.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button className="btn btn-danger" onClick={() => setConfirming(true)}>
        Delete tracker
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 440, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontWeight: 600 }}>Delete &quot;{trackerName}&quot;?</p>
      <p className="muted" style={{ fontSize: "0.9em" }}>
        This permanently removes every phase, activity, remark, and membership in this tracker. Type the tracker
        name to confirm.
      </p>
      <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={trackerName} />
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-danger" onClick={handleDelete} disabled={busy || typed !== trackerName}>
          {busy ? "Deleting…" : "Permanently delete"}
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
