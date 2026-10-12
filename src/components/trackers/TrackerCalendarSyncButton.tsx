"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

interface SyncResult {
  eligibleActivityCount: number;
  syncedMembers: { userId: string; name: string }[];
  invitedMembers: { userId: string; name: string; email: string }[];
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function TrackerCalendarSyncButton({
  trackerId,
  calendarSyncEnabled,
}: {
  trackerId: string;
  calendarSyncEnabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<SyncResult>(`/api/trackers/${trackerId}/calendar-sync`);
      setResult(data);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sync activities to calendar.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 20, maxWidth: 440, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontWeight: 600 }}>Calendar sync started</p>
        {result.syncedMembers.length > 0 && (
          <p className="muted" style={{ fontSize: "0.9em" }}>
            Synced {plural(result.eligibleActivityCount, "activity")} to{" "}
            {plural(result.syncedMembers.length, "member")} who already had Calendar connected.
          </p>
        )}
        {result.invitedMembers.length > 0 && (
          <p className="muted" style={{ fontSize: "0.9em" }}>
            Emailed {plural(result.invitedMembers.length, "member")} asking them to connect their calendar first.
          </p>
        )}
        {result.syncedMembers.length === 0 && result.invitedMembers.length === 0 && (
          <p className="muted" style={{ fontSize: "0.9em" }}>
            No members with a Google account were found to sync.
          </p>
        )}
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setResult(null)}>
          Done
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        className="btn"
        disabled={!calendarSyncEnabled}
        title={
          calendarSyncEnabled
            ? undefined
            : 'Turn on "Sync activity dates to Google Calendar" in Edit tracker first'
        }
        onClick={() => setConfirming(true)}
      >
        Sync activities to calendar
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 440, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontWeight: 600 }}>Sync activities to everyone&apos;s calendar?</p>
      <p className="muted" style={{ fontSize: "0.9em" }}>
        Only activities with both a start and end date are synced — activities missing either date are skipped.
      </p>
      <p className="muted" style={{ fontSize: "0.9em" }}>
        Members with a Google account (signed up with Google, or invited using a gmail.com address) who haven&apos;t
        connected their calendar yet will get an email asking for their permission. Everyone else is left alone.
      </p>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={handleSync} disabled={busy}>
          {busy ? "Syncing…" : "Yes, sync now"}
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
