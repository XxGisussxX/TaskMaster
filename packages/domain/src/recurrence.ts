import type { Recurrence } from "@taskmaster/contracts";

/**
 * Compute the next occurrence date based on a recurrence config and a base date.
 * Returns null if the recurrence has ended or is invalid.
 */
export function computeNextOccurrence(
  recurrence: Recurrence | null | undefined,
  baseDate: Date | string,
): Date | null {
  if (!recurrence) return null;

  const base = new Date(baseDate);
  const next = new Date(base);

  switch (recurrence.frequency) {
    case "DAILY":
      next.setDate(next.getDate() + recurrence.interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + recurrence.interval * 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + recurrence.interval);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + recurrence.interval);
      break;
  }

  if (recurrence.endDate) {
    const end = new Date(recurrence.endDate);
    if (next > end) return null;
  }

  return next;
}
