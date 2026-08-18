export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
  locale = "es",
): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale, options);
}

export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return "";
  return toLocalDateKey(toDate(date));
}

/** Local calendar date key (YYYY-MM-DD), timezone-safe. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a value into a Date. Date-only strings ("YYYY-MM-DD") are treated as
 * local midnight instead of UTC midnight to avoid timezone day-shifts.
 */
export function toDate(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  return new Date(value);
}

export function formatRelativeTime(
  date: Date | string,
  locale = "es",
  now = new Date(),
): string {
  const then = toDate(date).getTime();
  const diffSec = Math.round((then - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        Math.round(diffSec / secs),
        unit,
      );
    }
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    diffSec,
    "second",
  );
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = toDate(from);
  const b = toDate(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
