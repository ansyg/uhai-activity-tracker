interface ProgressRingProps {
  completed: number;
  inProgress: number;
  notStarted: number;
  size?: number;
  strokeWidth?: number;
}

/** A status-breakdown donut (ARCHITECTURE.md §8) — completed/in-progress/not-started as proportional arcs, with the completion % in the center. */
export function ProgressRing({ completed, inProgress, notStarted, size = 72, strokeWidth = 9 }: ProgressRingProps) {
  const total = completed + inProgress + notStarted;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = total
    ? [
        { value: completed, color: "var(--status-completed)" },
        { value: inProgress, color: "var(--status-in-progress)" },
        { value: notStarted, color: "var(--status-not-started)" },
      ]
    : [{ value: 1, color: "var(--status-not-started)" }];

  let offset = 0;
  const arcs = segments.map((segment, i) => {
    const fraction = segment.value / (total || 1);
    const dash = fraction * circumference;
    const dashArray = `${dash} ${circumference - dash}`;
    const dashOffset = -offset;
    offset += dash;
    return <circle key={i} r={radius} cx={size / 2} cy={size / 2} fill="none" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeDashoffset={dashOffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
  });

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        {arcs}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: size * 0.22,
        }}
      >
        {percent}%
      </div>
    </div>
  );
}
