"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { statusFromPercent } from "@/lib/activities/status";
import { toDateInputValue, isPlausibleDateInput, DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { IconComment } from "@/components/icons";
import { AssigneeManager } from "@/components/trackers/AssigneeManager";
import type { ActivityUpdatePatch } from "@/lib/activities/types";

interface Assignee {
  id: string;
  roleTag: string | null;
  user: { id: string; name: string } | null;
}

export interface ActivityCellData {
  id: string;
  title: string;
  statusPercent: number;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  module: { id: string; name: string } | null;
  assignees: Assignee[];
  lastUpdatedBy?: string | null;
  checklistDone?: number;
  checklistTotal?: number;
}

interface MemberOption {
  id: string;
  name: string;
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One cell component per column, each owning exactly the local state it
 * needs — shared by the Tracker board (via DataTable, one column each) and
 * the single-activity detail page (plain table, used directly). Each is a
 * real component (not an inline closure) specifically so it's legal for it
 * to hold its own hooks when called as `column.cell` from DataTable.
 */

export function ActivityTitleCell({ activity, trackerId }: { activity: ActivityCellData; trackerId: string }) {
  return (
    <>
      <Link href={`/trackers/${trackerId}/activities/${activity.id}`} style={{ fontWeight: 560 }}>
        {activity.title}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {activity.module && (
          <span className="muted" style={{ fontSize: "0.82em" }}>
            {activity.module.name}
          </span>
        )}
        {!!activity.checklistTotal && (
          <span
            className={`badge ${activity.checklistDone === activity.checklistTotal ? "badge-completed" : "badge-neutral"}`}
            style={{ fontSize: "0.72em", padding: "1px 7px" }}
          >
            ☑ {activity.checklistDone}/{activity.checklistTotal}
          </span>
        )}
      </div>
    </>
  );
}

export function AssigneesCell({
  activity,
  canEdit,
  members,
}: {
  activity: ActivityCellData;
  canEdit: boolean;
  /** Approved tracker members, for the inline "edit assignees" toggle. Omit to hide that affordance (e.g. read-only contexts). */
  members?: MemberOption[];
}) {
  const [assignees, setAssignees] = useState(activity.assignees);
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ minWidth: 160 }}>
      {editing ? (
        <AssigneeManager activityId={activity.id} assignees={assignees} members={members ?? []} canEdit={canEdit} onChange={setAssignees} />
      ) : assignees.length === 0 ? (
        <span className="muted">—</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {assignees.map((a) => (
            <span key={a.id} className={`badge ${a.user ? "badge-primary" : "badge-neutral"}`} style={{ fontSize: "0.78em" }}>
              {a.user?.name ?? a.roleTag}
            </span>
          ))}
        </div>
      )}
      {canEdit && members && (
        <button
          className="btn btn-ghost"
          style={{ fontSize: "0.76em", padding: "2px 0", marginTop: 4, display: "block" }}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : "Edit"}
        </button>
      )}
    </div>
  );
}

export function DatesCell({
  activity,
  canEdit,
  onUpdate,
}: {
  activity: ActivityCellData;
  canEdit: boolean;
  onUpdate?: (activityId: string, patch: ActivityUpdatePatch) => void;
}) {
  const [startDate, setStartDate] = useState(toDateInputValue(activity.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(activity.endDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!canEdit) {
    return (
      <span className="muted" style={{ whiteSpace: "nowrap" }}>
        {formatDate(activity.startDate)} → {formatDate(activity.endDate)}
      </span>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
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
      {error && <div className="error-text" style={{ fontSize: "0.78em" }}>{error}</div>}
    </div>
  );
}

/** Progress slider and the status it derives, together — they share one optimistic local state, so splitting them into separate columns would need a value mid-drag that hasn't round-tripped to the server yet. */
export function ProgressStatusCell({
  activity,
  canEdit,
  onUpdate,
}: {
  activity: ActivityCellData;
  canEdit: boolean;
  onUpdate?: (activityId: string, patch: ActivityUpdatePatch) => void;
}) {
  const [percent, setPercent] = useState(activity.statusPercent);
  const [status, setStatus] = useState(activity.status);
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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
      <StatusBadge status={status} />
      <div>
        {error && <div className="error-text" style={{ fontSize: "0.78em" }}>{error}</div>}
        {activity.lastUpdatedBy && (
          <div className="muted" style={{ fontSize: "0.72em" }}>
            by {activity.lastUpdatedBy}
          </div>
        )}
      </div>
    </div>
  );
}

export function PhaseMoveCell({
  activity,
  currentPhaseId,
  phases,
  canEdit,
  onMoved,
}: {
  activity: { id: string };
  currentPhaseId: string;
  phases: { id: string; name: string }[];
  canEdit: boolean;
  onMoved: (toPhaseId: string) => void;
}) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  return (
    <div>
      <select
        className="input"
        style={{ width: "auto", padding: "4px 8px", fontSize: "0.82em" }}
        value={currentPhaseId}
        disabled={moving}
        onChange={async (e) => {
          const toPhaseId = e.target.value;
          if (toPhaseId === currentPhaseId) return;
          setMoving(true);
          setError(null);
          try {
            await api.patch(`/api/activities/${activity.id}`, { phaseId: toPhaseId });
            onMoved(toPhaseId);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't move that activity.");
          } finally {
            setMoving(false);
          }
        }}
      >
        {phases.map((phase) => (
          <option key={phase.id} value={phase.id}>
            {phase.name}
          </option>
        ))}
      </select>
      {error && <div className="error-text" style={{ fontSize: "0.75em" }}>{error}</div>}
    </div>
  );
}

export function NotesLinkCell({
  activity,
  trackerId,
  commentCount,
}: {
  activity: ActivityCellData;
  trackerId: string;
  commentCount: number;
}) {
  return (
    <Link
      href={`/trackers/${trackerId}/activities/${activity.id}`}
      className="muted"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.85em" }}
      title="View notes and remarks"
    >
      <IconComment size={15} />
      {commentCount > 0 && commentCount}
    </Link>
  );
}
