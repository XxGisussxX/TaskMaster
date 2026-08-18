import {
  formatDate as domainFormatDate,
  formatDateISO,
  formatRelativeTime,
} from "@taskmaster/domain";

export { formatRelativeTime, formatDateISO };

export function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  return domainFormatDate(date, options, "es");
}
