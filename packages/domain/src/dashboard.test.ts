import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import {
  buildActivitySeries,
  buildHeatmapData,
  buildKpiTrends,
  computeKpis,
  priorityDistribution,
} from "../src/dashboard";
import { makeTask } from "./helpers";

const now = new Date("2026-08-07T12:00:00Z");

describe("computeKpis", () => {
  it("computes KPIs from real task data", () => {
    const tasks = [
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2026-08-07T09:00:00Z",
      }),
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2026-08-06T09:00:00Z",
      }),
      makeTask({ dueDate: "2026-08-01", status: TaskStatus.TODO }),
      makeTask({ status: TaskStatus.TODO }),
    ];
    const kpis = computeKpis(tasks, now);
    expect(kpis.completedToday).toBe(1);
    expect(kpis.overdueTasks).toBe(1);
    expect(kpis.activeTasks).toBe(2);
    expect(kpis.completionRate).toBe(50);
  });

  it("excludes ARCHIVED from activeTasks", () => {
    const tasks = [
      makeTask({ status: TaskStatus.TODO }),
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2026-08-07T09:00:00Z",
      }),
      makeTask({ status: TaskStatus.ARCHIVED }),
    ];
    const kpis = computeKpis(tasks, now);
    expect(kpis.activeTasks).toBe(1);
  });
});

describe("buildActivitySeries", () => {
  it("fills every day between from and to", () => {
    const tasks = [makeTask({ createdAt: "2026-08-01T10:00:00Z" })];
    const series = buildActivitySeries(
      tasks,
      new Date(2026, 7, 1),
      new Date(2026, 7, 3),
    );
    expect(series).toHaveLength(3);
    expect(series[0]?.created).toBe(1);
    expect(series[0]?.completed).toBe(0);
    expect(series[2]?.created).toBe(0);
  });
});

describe("buildKpiTrends", () => {
  const from = new Date(2026, 7, 1);
  const to = new Date(2026, 7, 3);

  it("tracks the daily evolution of every KPI", () => {
    const tasks = [
      makeTask({
        createdAt: "2026-08-01T09:00:00Z",
        dueDate: "2026-08-01",
        status: TaskStatus.TODO,
      }),
      makeTask({
        createdAt: "2026-08-01T09:00:00Z",
        status: TaskStatus.DONE,
        completedAt: "2026-08-02T10:00:00Z",
      }),
      makeTask({
        createdAt: "2026-08-02T09:00:00Z",
        dueDate: "2026-08-02",
        status: TaskStatus.TODO,
      }),
      makeTask({
        createdAt: "2026-08-01T09:00:00Z",
        status: TaskStatus.DONE,
        completedAt: "2026-08-03T09:00:00Z",
      }),
    ];
    const trends = buildKpiTrends(tasks, from, to);

    expect(trends).toHaveLength(3);
    expect(trends[0]).toEqual({
      date: "2026-08-01",
      active: 3,
      completed: 0,
      overdue: 0,
      avgCompletionDays: 0,
    });
    expect(trends[1]).toEqual({
      date: "2026-08-02",
      active: 3,
      completed: 1,
      overdue: 1,
      avgCompletionDays: 1,
    });
    expect(trends[2]).toEqual({
      date: "2026-08-03",
      active: 2,
      completed: 1,
      overdue: 2,
      avgCompletionDays: 2,
    });
  });

  it("never counts ARCHIVED tasks as active or overdue", () => {
    const trends = buildKpiTrends(
      [
        makeTask({
          createdAt: "2026-08-01T09:00:00Z",
          dueDate: "2026-08-01",
          status: TaskStatus.ARCHIVED,
        }),
      ],
      from,
      to,
    );
    expect(trends[2]?.active).toBe(0);
    expect(trends[2]?.overdue).toBe(0);
  });
});

describe("buildHeatmapData", () => {
  it("uses the requested year, not a hardcoded one", () => {
    const tasks = [
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2025-06-15T10:00:00Z",
      }),
      makeTask({
        status: TaskStatus.DONE,
        completedAt: "2026-06-15T10:00:00Z",
      }),
    ];
    const data = buildHeatmapData(tasks, 2026);
    expect(data).toHaveLength(365);
    const june15 = data.find((d) => d.date === "2026-06-15");
    expect(june15?.count).toBe(1);
    expect(data.find((d) => d.date === "2025-06-15")).toBeUndefined();
  });
});

describe("priorityDistribution", () => {
  it("always includes all four priorities", () => {
    const dist = priorityDistribution([
      makeTask({ priority: Priority.HIGH }),
      makeTask({ priority: Priority.MEDIUM }),
    ]);
    expect(dist).toEqual({
      LOW: 0,
      MEDIUM: 1,
      HIGH: 1,
      URGENT: 0,
    });
  });
});
