/** Converts a date (or null) into the yyyy-mm-dd string an <input type="date"> expects. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Sane bounds for every date input in the app — mainly guards against a stray keystroke saving a year like 0002. */
export const DATE_INPUT_MIN = "1970-01-01";
export const DATE_INPUT_MAX = "2100-12-31";

export function isPlausibleDateInput(value: string): boolean {
  return value === "" || (value >= DATE_INPUT_MIN && value <= DATE_INPUT_MAX);
}

/** Same bounds, for an ISO datetime string (what the API actually receives) rather than a date-input's yyyy-mm-dd. */
export function isPlausibleIsoDateTime(value: string): boolean {
  const year = new Date(value).getUTCFullYear();
  return year >= 1970 && year <= 2100;
}
