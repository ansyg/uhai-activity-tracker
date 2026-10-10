"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { statusFromPercent } from "@/lib/activities/status";
import { toDateInputValue, isPlausibleDateInput, DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { IconComment } from "@/components/icons";
import { AssigneeManager } from "@/components/trackers/AssigneeManager";

interface Assignee {
  id: string;
  roleTag: string | null;
  user: { id: string; name: string } | null;
}

interface ActivityData {
  id: string;
  title: string;
  statusPercent: number;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  module: { id: string; name: string } | null;
  assignees: Assignee[];
}

interface MemberOption {
  id: string;
  name: string;
}

export interface ActivityUpdatePatch {
  statusPercent?: number;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ActivityRow({
  activity,
  canEdit,
  trackerId,
  commentCount,
  members,
  onUpdate,
}: {
  activity: ActivityData;
  canEdit: boolean;
  trackerId: string;
  commentCount: number;
  /** Tracker's approved members, for the inline "edit assignees" toggle. Omit to hide that affordance (e.g. on the activity detail page, which has its own full assignee editor). */
  members?: MemberOption[];
  /** Notified after a successful progress/date save, so a parent board can recompute dashboard totals live instead of refetching from the server. */
  onUpdate?: (activityId: string, patch: ActivityUpdatePatch) => void;
}) {
  const [percent, setPercent] = useState(activity.statusPercent);
  const [status, setStatus] = useState(activity.status);
  const [startDate, setStartDate] = useState(toDateInputValue(activity.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(activity.endDate));
  const [assignees, setAssignees] = useState(activity.assignees);
  const [editingAssignees, setEditingAssignees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commitPercent(next: number) {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/activities/${activity.id}`, { statusPercent: next });
      const nextStatus = statusFromPercent(next);
      setStatus(nextStatus);
      onUpdate?.(activity.id, { statusPercent: next, status: nextStatus });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
      setPercent(activity.statusPercent);
    } finally {
      setSaving(false);
    }
  }

  async function commitDate(field: "startDate" | "endDate", value: string) {
    if (!isPlausibleDateInput(value)) return;
    const previous = field === "startDate" ? startDate : endDate;
    const setter = field === "startDate" ? setStartDate : setEndDate;
    setter(value);
    setSaving(true);
    setError(null);
    try {
      const iso = value ? new Date(value).toISOString() : null;
      await api.patch(`/api/activities/${activity.id}`, { [field]: iso });
      onUpdate?.(activity.id, { [field]: iso });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
      setter(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 14px" }}>
        <Link href={`/trackers/${trackerId}/activities/${activity.id}`} style={{ fontWeight: 560 }}>
          {activity.title}
        </Link>
        {activity.module && <div className="muted" style={{ fontSize: "0.82em" }}>{activity.module.name}</div>}
      </td>
      <td style={{ padding: "10px 14px", minWidth: 160 }}>
        {editingAssignees ? (
          <AssigneeManager
            activityId={activity.id}
            assignees={assignees}
            members={members ?? []}
            canEdit={canEdit}
            onChange={setAssignees}
          />
        ) : assignees.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          assignees.map((a) => a.user?.name ?? a.roleTag).join(", ")
        )}
        {canEdit && members && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: "0.76em", padding: "2px 0", marginTop: 4, display: "block" }}
            onClick={() => setEditingAssignees((v) => !v)}
          >
            {editingAssignees ? "Done" : "Edit"}
          </button>
        )}
      </td>
      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
        {canEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              className="input"
              value={startDate}
              min={DATE_INPUT_MIN}
              max={DATE_INPUT_MAX}
              disabled={saving}
              onChange={(e) => commitDate("startDate", e.target.value)}
              style={{ width: 132, padding: "5px 8px", fontSize: "0.85em" }}
            />
            <span className="muted">→</span>
            <input
              type="date"
              className="input"
              value={endDate}
              min={DATE_INPUT_MIN}
              max={DATE_INPUT_MAX}
              disabled={saving}
              onChange={(e) => commitDate("endDate", e.target.value)}
              style={{ width: 132, padding: "5px 8px", fontSize: "0.85em" }}
            />
          </div>
        ) : (
          <span className="muted">
            {formatDate(activity.startDate)} → {formatDate(activity.endDate)}
          </span>
        )}
      </td>
      <td style={{ padding: "10px 14px" }}>
        {canEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              disabled={saving}
              onChange={(e) => setPercent(Number(e.target.value))}
              onMouseUp={(e) => commitPercent(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => commitPercent(Number((e.target as HTMLInputElement).value))}
              style={{ width: 90 }}
            />
            <span className="muted" style={{ fontSize: "0.85em", width: 32 }}>
              {percent}%
            </span>
          </div>
        ) : (
          <div className="progress-track" style={{ width: 100 }}>
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
        )}
        {error && <div className="error-text" style={{ fontSize: "0.78em" }}>{error}</div>}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <StatusBadge status={status} />
      </td>
      <td style={{ padding: "10px 14px" }}>
        <Link
          href={`/trackers/${trackerId}/activities/${activity.id}`}
          className="muted"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85em" }}
          title="View notes and remarks"
        >
          <IconComment size={15} />
          {commentCount > 0 && commentCount}
        </Link>
      </td>
    </tr>
  );
}
