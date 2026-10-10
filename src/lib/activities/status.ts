import type { ActivityStatus } from "@prisma/client";

/** Derived from statusPercent and stored, not computed on read, so dashboard queries can GROUP BY status (ARCHITECTURE.md §4). */
export function statusFromPercent(percent: number): ActivityStatus {
  if (percent >= 100) return "COMPLETED";
  if (percent > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}
