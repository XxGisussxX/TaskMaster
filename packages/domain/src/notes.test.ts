import { describe, expect, it } from "vitest";
import { NoteType, StickyColor } from "@taskmaster/contracts";
import {
  getChecklistProgress,
  getContentSize,
  getDefaultColor,
  normalizeAttendees,
  sortNotes,
} from "../src/notes";
import { makeNote } from "./helpers";

describe("getDefaultColor", () => {
  it("maps each note type to its default color", () => {
    expect(getDefaultColor(NoteType.STANDARD)).toBe(StickyColor.YELLOW);
    expect(getDefaultColor(NoteType.CHECKLIST)).toBe(StickyColor.GREEN);
    expect(getDefaultColor(NoteType.IDEA)).toBe(StickyColor.PINK);
    expect(getDefaultColor(NoteType.MEETING)).toBe(StickyColor.BLUE);
  });
});

describe("getContentSize", () => {
  it("returns xs for tiny sticky notes", () => {
    expect(
      getContentSize(makeNote({ type: NoteType.STICKY, content: "hola" })),
    ).toBe("xs");
  });

  it("grows sticky notes with content length", () => {
    expect(
      getContentSize(
        makeNote({ type: NoteType.STICKY, content: "a".repeat(120) }),
      ),
    ).toBe("sm-plus");
  });

  it("sizes checklists by item count", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      text: `item ${i}`,
      done: false,
      order: i,
    }));
    expect(getContentSize(makeNote({ type: NoteType.CHECKLIST, items }))).toBe(
      "sm-plus",
    );
  });

  it("handles empty content without crashing", () => {
    expect(getContentSize(makeNote({ type: NoteType.STANDARD }))).toBe("xs");
  });
});

describe("getChecklistProgress", () => {
  it("computes percentage", () => {
    const progress = getChecklistProgress([
      { text: "a", done: true, order: 0 },
      { text: "b", done: false, order: 1 },
      { text: "c", done: true, order: 2 },
      { text: "d", done: true, order: 3 },
    ]);
    expect(progress.completed).toBe(3);
    expect(progress.total).toBe(4);
    expect(progress.percentage).toBe(75);
  });

  it("returns zero for empty list", () => {
    expect(getChecklistProgress([])).toEqual({
      completed: 0,
      total: 0,
      percentage: 0,
    });
  });
});

describe("normalizeAttendees", () => {
  it("splits newline/comma separated strings", () => {
    expect(normalizeAttendees("Juan, Maria\nPedro, Ana")).toEqual([
      "Juan",
      "Maria",
      "Pedro",
      "Ana",
    ]);
  });

  it("handles arrays and trims empties", () => {
    expect(normalizeAttendees(["  a  ", "", "b"])).toEqual(["a", "b"]);
    expect(normalizeAttendees(undefined)).toEqual([]);
    expect(normalizeAttendees(null)).toEqual([]);
  });
});

describe("sortNotes", () => {
  it("sorts newest first by created or updated", () => {
    const notes = [
      { createdAt: "2026-01-01", updatedAt: "2026-03-01" },
      { createdAt: "2026-02-01", updatedAt: "2026-02-01" },
    ] as unknown as { createdAt: string; updatedAt: string }[];
    expect(sortNotes(notes, "created")[0]?.createdAt).toBe("2026-02-01");
    expect(sortNotes(notes, "updated")[0]?.updatedAt).toBe("2026-03-01");
  });
});
