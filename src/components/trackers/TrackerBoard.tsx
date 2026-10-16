"use client";

import { useMemo, useState } from "react";
import { PhaseLane } from "@/components/trackers/PhaseLane";
import { DataTable, type Column, type TableFilter } from "@/components/ui/DataTable";
import {
  ActivityTitleCell,
  AssigneesCell,
  DatesCell,
  ProgressStatusCell,
  NotesLinkCell,
  PhaseMoveCell,
} from "@/components/trackers/ActivityCells";
import { NewPhaseForm } from "@/components/trackers/NewPhaseForm";
import { NewActivityForm } from "@/components/trackers/NewActivityForm";
import { DeletePhaseButton } from "@/components/trackers/DeletePhaseButton";
import { PhaseNameEditor } from "@/components/trackers/PhaseNameEditor";
import { computeDashboardFromActivities } from "@/lib/trackers/dashboard-client";
import type { ActivityUpdatePatch } from "@/lib/activities/types";

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
  checklistDone?: number;
  checklistTotal?: number;
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

export function TrackerBoard({
  trackerId,
  initialPhases,
  canEditActivities,
  canCreateActivities,
  canDeleteActivities,
  canManagePhases,
  moduleOptions,
  members,
}: {
  trackerId: string;
  initialPhases: PhaseData[];
  canEditActivities: boolean;
  canCreateActivities: boolean;
  canDeleteActivities: boolean;
  /** Structural phase changes (create/rename/delete) — narrower than canEdit/CreateActivities: Owner/Admin only, following Trello's "list structure is a board-admin action" split. */
  canManagePhases: boolean;
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

  // Most recent edit across every activity in the tracker — reads straight
  // off live `phases` state, so it updates the instant anyone saves a
  // change, same as the per-row "by <name>" cells (no refetch needed).
  const lastTrackerUpdate = useMemo(() => {
    let latest: { name: string; at: string } | null = null;
    for (const phase of phases) {
      for (const activity of phase.activities) {
        if (!activity.lastUpdatedBy || !activity.lastUpdatedAt) continue;
        const at = new Date(activity.lastUpdatedAt).toISOString();
        if (!latest || at > latest.at) latest = { name: activity.lastUpdatedBy, at };
      }
    }
    return latest;
  }, [phases]);

  const activityColumns: Column<ActivityData>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Activity",
        sortable: true,
        width: 220,
        cell: (activity) => <ActivityTitleCell activity={activity} trackerId={trackerId} />,
      },
      {
        key: "assignees",
        header: "Assignees",
        cell: (activity) => <AssigneesCell activity={activity} canEdit={canEditActivities} members={members} />,
      },
      {
        key: "startDate",
        header: "Dates",
        sortable: true,
        width: 300,
        cell: (activity) => <DatesCell activity={activity} canEdit={canEditActivities} onUpdate={handleActivityUpdate} />,
      },
      {
        key: "statusPercent",
        header: "Progress & status",
        sortable: true,
        width: 220,
        cell: (activity) => <ProgressStatusCell activity={activity} canEdit={canEditActivities} onUpdate={handleActivityUpdate} />,
      },
      {
        key: "notes",
        header: "",
        width: 56,
        cell: (activity) => <NotesLinkCell activity={activity} trackerId={trackerId} commentCount={activity.commentCount} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackerId, canEditActivities, members]
  );

  const activityFilters: TableFilter<ActivityData>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        value: (activity) => activity.status,
        options: [
          { value: "NOT_STARTED", label: "Not started" },
          { value: "IN_PROGRESS", label: "In progress" },
          { value: "COMPLETED", label: "Completed" },
        ],
      },
      ...(moduleOptions.length > 0
        ? [
            {
              key: "module",
              label: "Module",
              value: (activity: ActivityData) => activity.module?.id ?? "",
              options: moduleOptions.map((m) => ({ value: m.id, label: m.name })),
            },
          ]
        : []),
    ],
    [moduleOptions]
  );

  function getActivitySearchText(activity: ActivityData) {
    return [
      activity.title,
      activity.module?.name,
      ...activity.assignees.map((a) => a.user?.name ?? a.roleTag),
    ]
      .filter(Boolean)
      .join(" ");
  }

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

  function handleActivityMoved(activityId: string, fromPhaseId: string, toPhaseId: string) {
    setPhases((prev) => {
      const activity = prev.find((p) => p.id === fromPhaseId)?.activities.find((a) => a.id === activityId);
      if (!activity) return prev;
      return prev.map((phase) => {
        if (phase.id === fromPhaseId) return { ...phase, activities: phase.activities.filter((a) => a.id !== activityId) };
        if (phase.id === toPhaseId) return { ...phase, activities: [...phase.activities, activity] };
        return phase;
      });
    });
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
          {lastTrackerUpdate && (
            <div style={{ fontSize: "0.78em", opacity: 0.8, marginTop: 4 }}>
              Last updated by {lastTrackerUpdate.name} ·{" "}
              {new Date(lastTrackerUpdate.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          )}
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
      {canManagePhases && (
        <div style={{ marginBottom: 36 }}>
          <NewPhaseForm trackerId={trackerId} onCreated={handlePhaseCreated} />
        </div>
      )}

      <h3 style={{ marginBottom: 14 }}>Activities</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {phases.map((phase) => {
          const phaseColumns: Column<ActivityData>[] =
            canEditActivities && phases.length > 1
              ? [
                  ...activityColumns,
                  {
                    key: "phase",
                    header: "Phase",
                    width: 160,
                    cell: (activity) => (
                      <PhaseMoveCell
                        activity={activity}
                        currentPhaseId={phase.id}
                        phases={phases.map((p) => ({ id: p.id, name: p.name }))}
                        canEdit={canEditActivities}
                        onMoved={(toPhaseId) => handleActivityMoved(activity.id, phase.id, toPhaseId)}
                      />
                    ),
                  },
                ]
              : activityColumns;

          return (
          <div key={phase.id} id={`phase-${phase.id}`} style={{ scrollMarginTop: 90 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <PhaseNameEditor
                trackerId={trackerId}
                phaseId={phase.id}
                name={phase.name}
                canEdit={canManagePhases}
                onRenamed={(name) => handlePhaseRenamed(phase.id, name)}
              />
              {canManagePhases && phase.activities.length === 0 && (
                <DeletePhaseButton trackerId={trackerId} phaseId={phase.id} onDeleted={() => handlePhaseDeleted(phase.id)} />
              )}
            </div>
            <DataTable
              columns={phaseColumns}
              data={phase.activities}
              rowKey={(activity) => activity.id}
              minWidth={900}
              emptyTitle={phase.activities.length === 0 ? "No activities in this phase yet" : "No activities match"}
              emptyDescription={phase.activities.length === 0 ? undefined : "Try a different search or filter."}
              searchable
              searchPlaceholder="Search activities…"
              getSearchText={getActivitySearchText}
              filters={activityFilters}
              footer={
                canCreateActivities ? (
                  <NewActivityForm
                    trackerId={trackerId}
                    phaseId={phase.id}
                    modules={moduleOptions}
                    onCreated={(activity) => handleActivityCreated(phase.id, activity)}
                  />
                ) : undefined
              }
            />
          </div>
          );
        })}
      </div>
    </div>
  );
}
