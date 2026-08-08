import { NoteType, StickyColor } from "@taskmaster/contracts";
import type { ChecklistItemDto } from "@taskmaster/contracts";

export type ContentSize =
  "xs" | "small" | "sm-plus" | "medium" | "md-plus" | "large";

export const DEFAULT_NOTE_COLOR: Record<NoteType, StickyColor> = {
  [NoteType.STANDARD]: StickyColor.YELLOW,
  [NoteType.CHECKLIST]: StickyColor.GREEN,
  [NoteType.IDEA]: StickyColor.PINK,
  [NoteType.MEETING]: StickyColor.BLUE,
  [NoteType.STICKY]: StickyColor.YELLOW,
};

export function getDefaultColor(type: NoteType): StickyColor {
  return DEFAULT_NOTE_COLOR[type] ?? StickyColor.YELLOW;
}

export interface NoteContentInput {
  type: NoteType;
  content?: string | null;
  items?: ChecklistItemDto[] | null;
  tags?: string[] | null;
}

/**
 * Computes the card size for a note, mirroring the original layout algorithm
 * (height grows with content/checklist/attendees/action-items count).
 */
export function getContentSize(note: NoteContentInput): ContentSize {
  const { type, content, items, tags } = note;
  const contentLength = content?.length ?? 0;
  const tagCount = tags?.length ?? 0;

  if (type === NoteType.STICKY) {
    if (contentLength > 200) return "md-plus";
    if (contentLength > 150) return "medium";
    if (contentLength > 100) return "sm-plus";
    if (contentLength > 50) return "small";
    return "xs";
  }

  if (type === NoteType.STANDARD) {
    if (contentLength + tagCount * 10 > 250) return "md-plus";
    if (contentLength > 180) return "medium";
    if (contentLength > 120) return "sm-plus";
    if (contentLength > 60) return "small";
    return "xs";
  }

  if (type === NoteType.CHECKLIST) {
    const count = items?.length ?? 0;
    if (count >= 7) return "medium";
    if (count >= 5) return "sm-plus";
    if (count >= 2) return "small";
    if (count === 1) return "xs";
    return "xs";
  }

  if (type === NoteType.MEETING) {
    return "medium";
  }

  return "xs";
}

export function getChecklistProgress(items: ChecklistItemDto[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = items.length;
  const completed = items.filter((i) => i.done).length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Normalize attendees from raw string (newline/comma separated) or array.
 * This was previously buried inside the meeting-note content-size logic.
 */
export function normalizeAttendees(
  raw: string | string[] | null | undefined,
): string[] {
  if (Array.isArray(raw)) {
    return raw.map((a) => a.trim()).filter((a) => a.length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw
      .split(/[\n,]/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
  }
  return [];
}

export function sortNotes<T extends { createdAt: string; updatedAt: string }>(
  notes: T[],
  sortBy: "created" | "updated" = "created",
): T[] {
  return [...notes].sort((a, b) => {
    const key = sortBy === "updated" ? "updatedAt" : "createdAt";
    return new Date(b[key]).getTime() - new Date(a[key]).getTime();
  });
}
