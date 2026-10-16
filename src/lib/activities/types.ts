/** A successful progress/date save's new field(s) — passed up so a parent board can recompute dashboard totals live instead of refetching from the server. */
export interface ActivityUpdatePatch {
  statusPercent?: number;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}
