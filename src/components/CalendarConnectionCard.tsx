"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface Status {
  connected: boolean;
  calendarId: string | null;
  connectedAt: string | null;
}

export function CalendarConnectionCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("calendarError"));
  const [justConnected, setJustConnected] = useState(searchParams.get("calendarConnected") === "1");

  useEffect(() => {
    if (searchParams.get("calendarConnected") || searchParams.get("calendarError")) {
      router.replace("/account");
    }
  }, [searchParams, router]);

  useEffect(() => {
    api
      .get<Status>("/api/calendar/status")
      .then(setStatus)
      .catch(() => setStatus({ connected: false, calendarId: null, connectedAt: null }))
      .finally(() => setLoading(false));
  }, []);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api.delete("/api/calendar/disconnect");
      setStatus({ connected: false, calendarId: null, connectedAt: null });
      setJustConnected(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't disconnect Google Calendar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
      <div>
        <div style={{ fontWeight: 650, fontSize: "1.05rem" }}>Google Calendar</div>
        <p className="muted" style={{ fontSize: "0.9em" }}>
          When connected, activities with dates in a tracker that has Calendar sync turned on (its Edit tracker
          settings) are added to your calendar automatically.
        </p>
      </div>

      {justConnected && <p style={{ color: "var(--success, #2e9e5b)", fontSize: "0.9em" }}>Google Calendar connected.</p>}
      {error && <p className="error-text" style={{ fontSize: "0.9em" }}>{error}</p>}

      {loading ? (
        <p className="muted" style={{ fontSize: "0.9em" }}>
          Checking…
        </p>
      ) : status?.connected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="badge badge-completed">Connected</span>
          <button className="btn btn-danger" onClick={disconnect} disabled={busy}>
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <a className="btn btn-primary" href="/api/calendar/connect" style={{ alignSelf: "flex-start" }}>
          Connect Google Calendar
        </a>
      )}
    </div>
  );
}
