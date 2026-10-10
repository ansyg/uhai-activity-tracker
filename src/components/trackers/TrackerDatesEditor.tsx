"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { toDateInputValue, isPlausibleDateInput, DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/dates";

function formatDate(value: string) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TrackerDatesEditor({
  trackerId,
  startDate: initialStart,
  endDate: initialEnd,
  canEdit,
}: {
  trackerId: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(toDateInputValue(initialStart));
  const [endDate, setEndDate] = useState(toDateInputValue(initialEnd));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit(field: "startDate" | "endDate", value: string) {
    if (!isPlausibleDateInput(value)) return;
    const previous = field === "startDate" ? startDate : endDate;
    const setter = field === "startDate" ? setStartDate : setEndDate;
    setter(value);
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/trackers/${trackerId}`, { [field]: value ? new Date(value).toISOString() : null });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
      setter(previous);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    if (!start && !end) return null;
    return (
      <span className="muted" style={{ fontSize: "0.88em" }}>
        {start ?? "No start date"} → {end ?? "No end date"}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div>
        <label className="field-label" style={{ marginBottom: 2 }}>
          Start
        </label>
        <input
          type="date"
          className="input"
          value={startDate}
          min={DATE_INPUT_MIN}
          max={DATE_INPUT_MAX}
          disabled={saving}
          onChange={(e) => commit("startDate", e.target.value)}
          style={{ padding: "6px 8px", fontSize: "0.85em" }}
        />
      </div>
      <span className="muted" style={{ marginTop: 16 }}>
        →
      </span>
      <div>
        <label className="field-label" style={{ marginBottom: 2 }}>
          End
        </label>
        <input
          type="date"
          className="input"
          value={endDate}
          min={DATE_INPUT_MIN}
          max={DATE_INPUT_MAX}
          disabled={saving}
          onChange={(e) => commit("endDate", e.target.value)}
          style={{ padding: "6px 8px", fontSize: "0.85em" }}
        />
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
