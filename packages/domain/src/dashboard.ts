import { Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { isOverdue, startOfDay, endOfDay } from "./tasks";
import { toDate, toLocalDateKey } from "./date";

export interface ActivitySeries {
  date: string;
  created: number;
  completed: number;
}

export interface KpiTrend {
  date: string;
  active: number;
  completed: number;
  overdue: number;
  avgCompletionDays: number;
}

/** `null` = before the window start, `n` = after the window end. */
function indexInWindow(
  dayIndex: Map<string, number>,
  firstDate: string,
  key: string,
  length: number,
): number | null {
  const idx = dayIndex.get(key);
  if (idx !== undefined) return idx;
  return key < firstDate ? null : length;
}

/**
 * Daily KPI evolution over a date range (inclusive). Each point reflects the
 * state at the end of its day:
 * - `active`: tasks created on/before that day and not completed by then.
 * - `completed`: tasks completed that day.
 * - `overdue`: tasks whose due date falls strictly before that day and that
 *   are still open at the close of the day (mirrors `isOverdue`).
 * - `avgCompletionDays`: mean duration of the tasks completed that day.
 */
export function buildKpiTrends(
  tasks: Task[],
  from: Date,
  to: Date,
): KpiTrend[] {
  const days = buildActivitySeries(tasks, from, to);
  const n = days.length;
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));

  const active = new Array<number>(n).fill(0);
  const completed = new Array<number>(n).fill(0);
  const overdue = new Array<number>(n).fill(0);
  const cumulative = new Array<number>(n).fill(0);
  const counts = new Array<number>(n).fill(0);
  const firstDate = days[0]?.date ?? "";

  for (const task of tasks) {
    const closed =
      task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED;

    const createdIdx = indexInWindow(
      dayIndex,
      firstDate,
      toLocalDateKey(toDate(task.createdAt)),
      n,
    );
    if (createdIdx === n) continue;

    const completedKey = task.completedAt
      ? toLocalDateKey(toDate(task.completedAt))
      : null;
    const completedIdx = completedKey
      ? indexInWindow(dayIndex, firstDate, completedKey, n)
      : null;

    const activeEnd = closed && completedIdx === null ? 0 : (completedIdx ?? n);
    const activeStart = createdIdx ?? 0;
    if (activeStart < activeEnd) {
      active[activeStart]!++;
      active[activeEnd]!--;
    }

    if (completedIdx !== null && completedIdx < n) {
      completed[completedIdx]!++;
      const created = toDate(task.createdAt).getTime();
      const done = toDate(task.completedAt!).getTime();
      if (done >= created) {
        cumulative[completedIdx]! += (done - created) / 86_400_000;
        counts[completedIdx]!++;
      }
    }

    if (task.dueDate) {
      const dueKey = toLocalDateKey(toDate(task.dueDate));
      const dueIdx = indexInWindow(dayIndex, firstDate, dueKey, n);
      const overdueStart = dueIdx === null ? 0 : dueIdx + 1;
      const overdueEnd = completedIdx ?? (closed ? 0 : n);
      if (overdueStart < overdueEnd) {
        overdue[overdueStart]!++;
        overdue[overdueEnd]!--;
      }
    }
  }

  let runningActive = 0;
  let runningOverdue = 0;
  return days.map((day, i) => {
    runningActive += active[i]!;
    runningOverdue += overdue[i]!;
    const count = counts[i]!;
    return {
      date: day.date,
      active: runningActive,
      completed: completed[i]!,
      overdue: runningOverdue,
      avgCompletionDays:
        count > 0 ? Math.round((cumulative[i]! / count) * 10) / 10 : 0,
    };
  });
}

/** Build a daily created/completed series between two dates (inclusive). */
export function buildActivitySeries(
  tasks: Task[],
  from: Date,
  to: Date,
): ActivitySeries[] {
  const days: ActivitySeries[] = [];
  const cursor = startOfDay(from);
  const end = endOfDay(to);

  while (cursor.getTime() <= end.getTime()) {
    const iso = toLocalDateKey(cursor);
    days.push({ date: iso, created: 0, completed: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const dayIndex = new Map(days.map((d, i) => [d.date, i]));

  for (const task of tasks) {
    const createdKey = toLocalDateKey(toDate(task.createdAt));
    const createdIdx = dayIndex.get(createdKey);
    if (createdIdx !== undefined) days[createdIdx]!.created++;

    if (task.completedAt) {
      const completedKey = toLocalDateKey(toDate(task.completedAt));
      const completedIdx = dayIndex.get(completedKey);
      if (completedIdx !== undefined) days[completedIdx]!.completed++;
    }
  }

  return days;
}

export function buildHeatmapData(
  tasks: Task[],
  year = new Date().getFullYear(),
): { date: string; count: number }[] {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const date = task.completedAt ?? task.createdAt;
    const d = toDate(date);
    if (d.getFullYear() !== year) continue;
    const key = toLocalDateKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: { date: string; count: number }[] = [];
  const cursor = startOfDay(start);
  const endDate = endOfDay(end);
  while (cursor.getTime() <= endDate.getTime()) {
    const key = `${cursor.getFullYear()}-${String(
      cursor.getMonth() + 1,
    ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    result.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export interface DashboardKpis {
  activeTasks: number;
  completedToday: number;
  overdueTasks: number;
  overdueCritical: number;
  avgCompletionDays: number;
  completionRate: number;
}

export function computeKpis(tasks: Task[], now = new Date()): DashboardKpis {
  const completed = tasks.filter((t) => t.status === TaskStatus.DONE);
  const todayKey = toLocalDateKey(toDate(now));
  const completedToday = completed.filter((t) => {
    return toLocalDateKey(toDate(t.completedAt!)) === todayKey;
  }).length;

  const durations: number[] = [];
  for (const t of completed) {
    const created = new Date(t.createdAt).getTime();
    const done = new Date(t.completedAt!).getTime();
    if (done >= created) durations.push((done - created) / 86_400_000);
  }
  const avgCompletionDays =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  const doneCount = completed.length;
  const activeTasks = tasks.filter(
    (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.ARCHIVED,
  ).length;
  return {
    activeTasks,
    completedToday,
    overdueTasks: tasks.filter((t) => isOverdue(t, now)).length,
    overdueCritical: tasks.filter(
      (t) =>
        isOverdue(t, now) &&
        (t.priority === Priority.URGENT || t.priority === Priority.HIGH),
    ).length,
    avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
    completionRate:
      tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0,
  };
}

export function priorityDistribution(tasks: Task[]): Record<Priority, number> {
  const dist: Record<Priority, number> = {
    [Priority.LOW]: 0,
    [Priority.MEDIUM]: 0,
    [Priority.HIGH]: 0,
    [Priority.URGENT]: 0,
  };
  for (const t of tasks) dist[t.priority]++;
  return dist;
}
