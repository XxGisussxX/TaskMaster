import { Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { toDate, toLocalDateKey } from "./date";

export const PRIORITY_RANK: Record<Priority, number> = {
  [Priority.LOW]: 3,
  [Priority.MEDIUM]: 2,
  [Priority.HIGH]: 1,
  [Priority.URGENT]: 0,
};

export const STATUS_ORDER: Record<TaskStatus, number> = {
  [TaskStatus.TODO]: 0,
  [TaskStatus.IN_PROGRESS]: 1,
  [TaskStatus.IN_REVIEW]: 2,
  [TaskStatus.DONE]: 3,
  [TaskStatus.ARCHIVED]: 4,
};

export function isOverdue(
  task: Pick<Task, "dueDate" | "status">,
  now = new Date(),
): boolean {
  if (!task.dueDate) return false;
  if (task.status === TaskStatus.DONE || task.status === TaskStatus.ARCHIVED) {
    return false;
  }
  return toLocalDateKey(toDate(task.dueDate)) < toLocalDateKey(toDate(now));
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isDueToday(task: Task, now = new Date()): boolean {
  if (!task.dueDate) return false;
  return toLocalDateKey(toDate(task.dueDate)) === toLocalDateKey(toDate(now));
}

export interface TaskStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  dueToday: number;
  completionRate: number;
}

export function getTaskStats(tasks: Task[], now = new Date()): TaskStats {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const active = tasks.filter(
    (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.ARCHIVED,
  ).length;
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  const dueToday = tasks.filter((t) => isDueToday(t, now)).length;

  return {
    total,
    active,
    completed,
    overdue,
    dueToday,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export type TaskSortKey =
  "priority" | "dueDate" | "createdAt" | "updatedAt" | "status";

export function sortTasks(
  tasks: Task[],
  sortBy: TaskSortKey = "dueDate",
): Task[] {
  const sorted = [...tasks];
  switch (sortBy) {
    case "priority":
      return sorted.sort(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    case "dueDate":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    case "createdAt":
      return sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "updatedAt":
      return sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    case "status":
      return sorted.sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      );
    default:
      return sorted;
  }
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
  onlyOverdue?: boolean;
  onlyMine?: boolean;
  assigneeId?: string;
  tagId?: string;
  channelId?: string;
  dueDateFrom?: Date | string;
  dueDateTo?: Date | string;
}

export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  currentUserId?: string,
): Task[] {
  const q = filters.search?.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.channelId && task.channelId !== filters.channelId) return false;
    if (filters.tagId && !task.tags.some((t) => t.id === filters.tagId))
      return false;
    if (
      filters.assigneeId &&
      !task.assignees.some((a) => a.id === filters.assigneeId)
    ) {
      return false;
    }
    if (filters.onlyMine) {
      if (!currentUserId || !task.assignees.some((a) => a.id === currentUserId))
        return false;
    }
    if (filters.onlyOverdue && !isOverdue(task)) return false;
    if (filters.dueDateFrom && task.dueDate) {
      if (
        new Date(task.dueDate).getTime() <
        new Date(filters.dueDateFrom).getTime()
      ) {
        return false;
      }
    }
    if (filters.dueDateTo && task.dueDate) {
      if (
        new Date(task.dueDate).getTime() > new Date(filters.dueDateTo).getTime()
      ) {
        return false;
      }
    }
    if (q) {
      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  return filterTasks(tasks, { search: query });
}

export function getTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status);
}

export function getOverdueTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((t) => isOverdue(t, now));
}

export function buildTaskTree(tasks: Task[]): Task[] {
  const byId = new Map(
    tasks.map((t) => [t.id, { ...t, subtasks: [] as Task[] }]),
  );
  const roots: Task[] = [];

  for (const task of byId.values()) {
    if (task.parentId && byId.has(task.parentId)) {
      byId.get(task.parentId)!.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }

  const sortSubtasks = (node: Task): void => {
    node.subtasks.sort((a, b) => a.order - b.order);
    node.subtasks.forEach(sortSubtasks);
  };
  roots.forEach(sortSubtasks);

  return roots;
}
