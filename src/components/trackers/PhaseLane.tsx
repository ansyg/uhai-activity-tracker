import Link from "next/link";
import { AvatarStack } from "@/components/AvatarStack";

interface PhaseLaneData {
  phaseId: string;
  name: string;
  sequence: number;
  total: number;
  completed: number;
  avgPercent: number;
  assignees: { id: string; name: string }[];
  roleTags: string[];
}

export function PhaseLane({ phase, trackerId }: { phase: PhaseLaneData; trackerId: string }) {
  return (
    <Link href={`/trackers/${trackerId}#phase-${phase.phaseId}`} className="lane">
      <div className="lane-fill" style={{ width: `${phase.avgPercent}%` }} />
      <div className="lane-content">
        <div>
          <div style={{ fontWeight: 650 }}>{phase.name}</div>
          <div className="muted" style={{ fontSize: "0.82em" }}>
            {phase.completed} of {phase.total} done
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {phase.assignees.length > 0 ? (
            <AvatarStack people={phase.assignees} max={3} />
          ) : phase.roleTags.length > 0 ? (
            <span className="muted" style={{ fontSize: "0.78em", maxWidth: 160, textAlign: "right" }}>
              {phase.roleTags.slice(0, 3).join(", ")}
            </span>
          ) : null}
          <span className="stat-value" style={{ fontSize: "1.1rem", minWidth: "3ch", textAlign: "right" }}>
            {phase.avgPercent}%
          </span>
        </div>
      </div>
    </Link>
  );
}
