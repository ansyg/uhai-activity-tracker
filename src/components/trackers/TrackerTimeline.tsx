import Link from "next/link";

export interface TimelineActivity {
  id: string;
  title: string;
  phaseId: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  statusPercent: number;
}

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 16;
const TICK_COUNT = 6;

/** Precise day, for the tooltip and bar dates — where exactly when an activity starts/ends matters. */
function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Month + year, for axis ticks — "Sep 24" on its own reads as ambiguous (day? year?); "Sep 2026" doesn't. */
function formatAxisTick(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function statusColor(activity: TimelineActivity): { color: string; label: string } {
  const overdue = activity.status !== "COMPLETED" && new Date(activity.endDate).getTime() < Date.now();
  if (overdue) return { color: "var(--danger)", label: "Overdue" };
  if (activity.status === "COMPLETED") return { color: "var(--status-completed)", label: "Completed" };
  if (activity.status === "IN_PROGRESS") return { color: "var(--status-in-progress)", label: "In progress" };
  return { color: "var(--status-not-started)", label: "Not started" };
}

/**
 * A read-only project timeline (dataviz skill: horizontal interval bars,
 * status is the categorical channel — reusing this app's existing reserved
 * status colors/badges rather than a new palette). Editing dates still
 * happens through the activity row/detail page; this is a second view onto
 * the same data, which is what the skill's "table view exists" check asks
 * for — the Activities table elsewhere on the tracker page is that twin.
 */
export function TrackerTimeline({ trackerId, activities }: { trackerId: string; activities: TimelineActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Nothing scheduled yet</p>
        <p className="muted" style={{ fontSize: "0.9em" }}>
          Give activities a start and end date to see them laid out here.
        </p>
      </div>
    );
  }

  const starts = activities.map((a) => new Date(a.startDate).getTime());
  const ends = activities.map((a) => new Date(a.endDate).getTime());
  const rawMin = Math.min(...starts);
  const rawMax = Math.max(...ends);
  const pad = Math.max((rawMax - rawMin) * 0.04, 1000 * 60 * 60 * 24); // at least a day of breathing room
  const domainStart = rawMin - pad;
  const domainEnd = rawMax + pad;
  const domainSpan = domainEnd - domainStart;

  function toPercent(time: number) {
    return ((time - domainStart) / domainSpan) * 100;
  }

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const time = domainStart + (domainSpan * i) / (TICK_COUNT - 1);
    return { time, percent: toPercent(time), date: new Date(time) };
  });

  const now = Date.now();
  const todayPercent = now >= domainStart && now <= domainEnd ? toPercent(now) : null;

  const phaseOrder: string[] = [];
  const byPhase = new Map<string, { name: string; items: TimelineActivity[] }>();
  for (const activity of activities) {
    if (!byPhase.has(activity.phaseId)) {
      byPhase.set(activity.phaseId, { name: activity.phaseName, items: [] });
      phaseOrder.push(activity.phaseId);
    }
    byPhase.get(activity.phaseId)!.items.push(activity);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="badge badge-not-started">Not started</span>
        <span className="badge badge-in-progress">In progress</span>
        <span className="badge badge-completed">Completed</span>
        <span className="badge badge-danger">Overdue</span>
      </div>

      <div className="card" style={{ padding: "16px 20px 20px", overflowX: "auto" }}>
        <div style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", columnGap: 12, rowGap: 6, minWidth: 720 }}>
            {/* Axis row — every item below gets an explicit gridColumn rather than
                relying on auto-placement, since that interacted badly with the
                display:contents phase-grouping wrappers further down. */}
            <div style={{ gridColumn: 1 }} />
            <div style={{ gridColumn: 2, position: "relative", height: 20 }}>
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="muted"
                  style={{
                    position: "absolute",
                    left: `${tick.percent}%`,
                    transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                    fontSize: "0.74em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatAxisTick(tick.date)}
                </span>
              ))}
            </div>

            {phaseOrder.map((phaseId) => {
              const phase = byPhase.get(phaseId)!;
              return (
                <div key={phaseId} style={{ display: "contents" }}>
                  <div style={{ gridColumn: "1 / -1", marginTop: 10 }}>
                    <span style={{ fontSize: "0.82em", fontWeight: 650, color: "var(--ink-muted)" }}>{phase.name}</span>
                  </div>
                  {phase.items.map((activity) => {
                    const start = new Date(activity.startDate).getTime();
                    const end = new Date(activity.endDate).getTime();
                    const left = toPercent(start);
                    const width = Math.max(toPercent(end) - left, 1.2);
                    const { color, label } = statusColor(activity);
                    return (
                      <div key={activity.id} style={{ display: "contents" }}>
                        <Link
                          href={`/trackers/${trackerId}/activities/${activity.id}`}
                          className="gantt-label"
                          style={{
                            gridColumn: 1,
                            fontSize: "0.84em",
                            lineHeight: `${ROW_HEIGHT}px`,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={activity.title}
                        >
                          {activity.title}
                        </Link>
                        <div style={{ gridColumn: 2, position: "relative", height: ROW_HEIGHT }}>
                          <div className="gantt-track-line" />
                          <div
                            className="gantt-bar-wrap"
                            tabIndex={0}
                            role="img"
                            aria-label={`${activity.title}: ${label}, ${formatDay(new Date(start))} to ${formatDay(new Date(end))}, ${activity.statusPercent}% complete`}
                            style={{
                              position: "absolute",
                              left: `${left}%`,
                              width: `${width}%`,
                              top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                              height: BAR_HEIGHT,
                              borderRadius: 4,
                              background: color,
                            }}
                          >
                            <div className="gantt-tooltip">
                              <strong>{activity.title}</strong>
                              <div style={{ fontSize: "0.85em", opacity: 0.8 }}>
                                {formatDay(new Date(start))} – {formatDay(new Date(end))} · {label} · {activity.statusPercent}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {todayPercent !== null && (
            // Deliberately outside the grid (a sibling overlay, not a grid item)
            // so it never needs to know the grid's total row count — it just
            // matches column 2's fixed left offset (200px label + 12px gap).
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 212, right: 0, pointerEvents: "none" }}>
              <div
                style={{
                  position: "absolute",
                  left: `${todayPercent}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--accent)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
