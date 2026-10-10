const LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

const CLASS: Record<string, string> = {
  NOT_STARTED: "badge-not-started",
  IN_PROGRESS: "badge-in-progress",
  COMPLETED: "badge-completed",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${CLASS[status] ?? "badge-not-started"}`}>{LABELS[status] ?? status}</span>;
}
