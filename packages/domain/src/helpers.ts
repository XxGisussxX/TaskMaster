import { NoteType, Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: "ws1",
    creatorId: "u1",
    title: overrides.title ?? "Task",
    description: overrides.description ?? "",
    status: overrides.status ?? TaskStatus.TODO,
    priority: overrides.priority ?? Priority.MEDIUM,
    dueDate: overrides.dueDate ?? null,
    startDate: overrides.startDate ?? null,
    order: overrides.order ?? 0,
    parentId: overrides.parentId ?? null,
    categoryId: overrides.categoryId ?? null,
    category: overrides.category ?? null,
    tags: overrides.tags ?? [],
    assignees: overrides.assignees ?? [],
    subtasks: overrides.subtasks ?? [],
    isRecurring: overrides.isRecurring ?? false,
    recurrence: overrides.recurrence ?? null,
    createdAt: overrides.createdAt ?? "2026-08-01T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-01T09:00:00.000Z",
    completedAt: overrides.completedAt ?? null,
  };
}

export function makeNote(
  overrides: Partial<{
    type: NoteType;
    content: string | null;
    items: { text: string; done: boolean; order: number }[];
    tags: string[];
  }> = {},
) {
  return {
    type: overrides.type ?? NoteType.STANDARD,
    content: overrides.content ?? null,
    items: overrides.items ?? null,
    tags: overrides.tags ?? null,
  };
}
