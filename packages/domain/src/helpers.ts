import { NoteType, Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import type { AgendaTask } from "./agenda";

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
    channelId: overrides.channelId ?? null,
    channel: overrides.channel ?? null,
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

export function makeAssignee(id: string) {
  return {
    id,
    user: { id, name: id, email: `${id}@test.local`, avatarUrl: null },
  };
}

/** Tarea con la forma mínima que consume la revisión de agenda. */
export function makeAgendaTask(
  overrides: Partial<{
    id: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
    startDate: string | null;
    completedAt: string | null;
    assigneeIds: string[];
  }> = {},
): AgendaTask {
  const ids = overrides.assigneeIds ?? [];
  return {
    id: overrides.id ?? crypto.randomUUID(),
    status: overrides.status ?? TaskStatus.TODO,
    priority: overrides.priority ?? Priority.MEDIUM,
    dueDate: overrides.dueDate ?? null,
    startDate: overrides.startDate ?? null,
    completedAt: overrides.completedAt ?? null,
    assignees: ids.map(makeAssignee),
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
