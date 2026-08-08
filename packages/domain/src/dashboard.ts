import { Priority } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { isOverdue, startOfDay, endOfDay } from "./tasks";
import { toDate, toLocalDateKey } from "./date";

export interface ActivitySeries {
  date: string;
  created: number;
  completed: number;
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
  avgCompletionDays: number;
  completionRate: number;
}

export function computeKpis(tasks: Task[], now = new Date()): DashboardKpis {
  const completed = tasks.filter((t) => t.completedAt);
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
  return {
    activeTasks: tasks.length - doneCount,
    completedToday,
    overdueTasks: tasks.filter((t) => isOverdue(t, now)).length,
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
