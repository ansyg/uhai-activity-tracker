"use client";

import { useMemo, useState } from "react";
import { PhaseLane } from "@/components/trackers/PhaseLane";
import { ActivityRow, type ActivityUpdatePatch } from "@/components/trackers/ActivityRow";
import { NewPhaseForm } from "@/components/trackers/NewPhaseForm";
import { NewActivityForm } from "@/components/trackers/NewActivityForm";
import { DeletePhaseButton } from "@/components/trackers/DeletePhaseButton";
import { PhaseNameEditor } from "@/components/trackers/PhaseNameEditor";
import { computeDashboardFromActivities } from "@/lib/trackers/dashboard-client";

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
  commentCount: number;
  lastUpdatedBy?: string | null;
  lastUpdatedAt?: string | Date | null;
}

interface PhaseData {
  id: string;
  name: string;
  sequence: number;
  activities: ActivityData[];
}

interface ModuleOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string;
}

const TONE_CLASS: Record<string, string> = {
  "in-progress": "badge-in-progress",
  "not-started": "badge-not-started",
  danger: "badge-danger",
};

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card stat-tile">
      <div className={`badge ${TONE_CLASS[tone]}`} style={{ marginBottom: 10 }}>
        {label}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding: "10px 14px", fontWeight: 600, fontSize: "0.85em", borderBottom: "1px solid var(--border)", ...style }}>
      {children}
    </th>
  );
}

export function TrackerBoard({
  trackerId,
  initialPhases,
  canEditActivities,
  canCreateActivities,
  canDeleteActivities,
  moduleOptions,
  members,
}: {
  trackerId: string;
  initialPhases: PhaseData[];
  canEditActivities: boolean;
  canCreateActivities: boolean;
  canDeleteActivities: boolean;
  moduleOptions: ModuleOption[];
  members: MemberOption[];
}) {
  const [phases, setPhases] = useState(initialPhases);

  const dashboard = useMemo(() => {
    const flatActivities = phases.flatMap((phase) =>
      phase.activities.map((activity) => ({ ...activity, phaseId: phase.id }))
    );
    return computeDashboardFromActivities(flatActivities, phases);
  }, [phases]);

  const completionPercent = dashboard.totals.total
    ? Math.round((dashboard.totals.completed / dashboard.totals.total) * 100)
    : 0;

  function handleActivityUpdate(activityId: string, patch: ActivityUpdatePatch) {
    setPhases((prev) =>
      prev.map((phase) => ({
        ...phase,
        activities: phase.activities.map((activity) =>
          activity.id === activityId ? { ...activity, ...patch } : activity
        ),
      }))
    );
  }

  function handleActivityCreated(phaseId: string, activity: ActivityData) {
    setPhases((prev) =>
      prev.map((phase) => (phase.id === phaseId ? { ...phase, activities: [...phase.activities, activity] } : phase))
    );
  }

  function handlePhaseCreated(phase: { id: string; name: string; sequence: number }) {
    setPhases((prev) => [...prev, { ...phase, activities: [] }]);
  }

  function handlePhaseDeleted(phaseId: string) {
    setPhases((prev) => prev.filter((phase) => phase.id !== phaseId));
  }

  function handlePhaseRenamed(phaseId: string, name: string) {
    setPhases((prev) => prev.map((phase) => (phase.id === phaseId ? { ...phase, name } : phase)));
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="card-fill stat-tile">
          <div className="stat-label" style={{ opacity: 0.85 }}>
            Overall completion
          </div>
          <div className="stat-value" style={{ fontSize: "2.4rem" }}>
            {completionPercent}%
          </div>
          <div style={{ fontSize: "0.85em", opacity: 0.9, marginTop: 6 }}>
            {dashboard.totals.completed} of {dashboard.totals.total} activities completed
          </div>
        </div>
        <SummaryTile label="In progress" value={dashboard.totals.inProgress} tone="in-progress" />
        <SummaryTile label="Not started" value={dashboard.totals.notStarted} tone="not-started" />
        <SummaryTile label="Overdue" value={dashboard.overdue} tone="danger" />
      </div>

      <h3 style={{ marginBottom: 14 }}>Progress by phase</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {dashboard.byPhase.map((phase) => (
          <PhaseLane key={phase.phaseId} phase={phase} trackerId={trackerId} />
        ))}
      </div>
      {canCreateActivities && (
        <div style={{ marginBottom: 36 }}>
          <NewPhaseForm trackerId={trackerId} onCreated={handlePhaseCreated} />
        </div>
      )}

      <h3 style={{ marginBottom: 14 }}>Activities</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {phases.map((phase) => (
          <div key={phase.id} id={`phase-${phase.id}`} style={{ scrollMarginTop: 90 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <PhaseNameEditor
                trackerId={trackerId}
                phaseId={phase.id}
                name={phase.name}
                canEdit={canEditActivities}
                onRenamed={(name) => handlePhaseRenamed(phase.id, name)}
              />
              {canDeleteActivities && phase.activities.length === 0 && (
                <DeletePhaseButton trackerId={trackerId} phaseId={phase.id} onDeleted={() => handlePhaseDeleted(phase.id)} />
              )}
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "var(--surface-muted)" }}>
                    <Th>Activity</Th>
                    <Th>Assignees</Th>
                    <Th>Dates</Th>
                    <Th style={{ width: 180 }}>Progress</Th>
                    <Th>Status</Th>
                    <Th style={{ width: 56 }} />
                  </tr>
                </thead>
                <tbody>
                  {phase.activities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      canEdit={canEditActivities}
                      trackerId={trackerId}
                      commentCount={activity.commentCount}
                      members={members}
                      onUpdate={handleActivityUpdate}
                    />
                  ))}
                </tbody>
              </table>
              {canCreateActivities && (
                <NewActivityForm
                  trackerId={trackerId}
                  phaseId={phase.id}
                  modules={moduleOptions}
                  onCreated={(activity) => handleActivityCreated(phase.id, activity)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
