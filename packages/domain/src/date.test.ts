import { describe, expect, it } from "vitest";
import {
  toDate,
  daysBetween,
  formatRelativeTime,
  toLocalDateKey,
} from "../src/date";

describe("toDate", () => {
  it("parses date-only strings as local midnight", () => {
    const d = toDate("2026-08-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it("parses ISO strings with time correctly", () => {
    const d = toDate("2026-08-15T10:30:00Z");
    expect(d.toISOString()).toBe("2026-08-15T10:30:00.000Z");
  });

  it("returns a copy for Date inputs", () => {
    const original = new Date(2026, 7, 15);
    const copy = toDate(original);
    expect(copy.getTime()).toBe(original.getTime());
    expect(copy).not.toBe(original);
  });
});

describe("daysBetween", () => {
  it("counts days between two date-only strings", () => {
    expect(daysBetween("2026-08-01", "2026-08-04")).toBe(3);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-08-15", "2026-08-15")).toBe(0);
  });

  it("handles negative direction", () => {
    expect(daysBetween("2026-08-10", "2026-08-07")).toBe(-3);
  });

  it("works with Date objects", () => {
    const a = new Date(2026, 7, 1);
    const b = new Date(2026, 7, 6);
    expect(daysBetween(a, b)).toBe(5);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-15T12:00:00Z");

  it("returns seconds for recent timestamps", () => {
    const result = formatRelativeTime("2026-08-15T11:59:55Z", "en", now);
    expect(result).toMatch(/second/);
  });

  it("returns minutes for timestamps a few minutes ago", () => {
    const result = formatRelativeTime("2026-08-15T11:55:00Z", "en", now);
    expect(result).toMatch(/minute/);
  });

  it("returns hours for timestamps a few hours ago", () => {
    const result = formatRelativeTime("2026-08-15T09:00:00Z", "en", now);
    expect(result).toMatch(/hour/);
  });

  it("returns days for timestamps a few days ago", () => {
    const result = formatRelativeTime("2026-08-13T12:00:00Z", "en", now);
    expect(result).toMatch(/2 days/);
  });
});

describe("toLocalDateKey", () => {
  it("produces YYYY-MM-DD from a Date", () => {
    const d = new Date(2026, 0, 5);
    expect(toLocalDateKey(d)).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 2, 9);
    expect(toLocalDateKey(d)).toBe("2026-03-09");
  });
});
