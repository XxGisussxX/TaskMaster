import type {
  Task,
  Paginated,
  Priority,
  TaskStatus,
} from "@taskmaster/contracts";

const LOCAL_WORKSPACE_ID = "local-demo-workspace";
const STORAGE_KEY = "taskmaster.local.tasks";

type StoredTasks = Record<string, Task[]>;

function readStore(): StoredTasks {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredTasks;
  } catch {
    return {};
  }
}

function writeStore(store: StoredTasks): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function seedTask(workspaceId: string): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    workspaceId,
    creatorId: "local-demo-user",
    title: "Tu primera tarea",
    description:
      "Esta tarea se guarda localmente mientras la API no esté disponible.",
    status: "TODO" as TaskStatus,
    priority: "MEDIUM" as Priority,
    dueDate: null,
    startDate: null,
    order: 0,
    parentId: null,
    categoryId: null,
    category: null,
    tags: [],
    assignees: [],
    subtasks: [],
    isRecurring: false,
    recurrence: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    tags: [...task.tags],
    assignees: [...task.assignees],
    subtasks: task.subtasks.map((subtask) => cloneTask(subtask)),
  };
}

function ensureWorkspaceTasks(store: StoredTasks, workspaceId: string): Task[] {
  if (!store[workspaceId]) {
    store[workspaceId] = [seedTask(workspaceId)];
    writeStore(store);
  }
  return store[workspaceId]!;
}

export function isLocalWorkspace(workspaceId: string): boolean {
  return workspaceId === LOCAL_WORKSPACE_ID;
}

export function getLocalWorkspaceId(): string {
  return LOCAL_WORKSPACE_ID;
}

export function listLocalTasks(workspaceId: string): Paginated<Task> {
  const store = readStore();
  const items = ensureWorkspaceTasks(store, workspaceId).map(cloneTask);
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length || 10,
    totalPages: 1,
  };
}

export function createLocalTask(
  workspaceId: string,
  input: Record<string, unknown>,
): Task {
  const store = readStore();
  const tasks = ensureWorkspaceTasks(store, workspaceId);
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    workspaceId,
    creatorId: "local-demo-user",
    title: String(input.title ?? "Nueva tarea"),
    description: String(input.description ?? ""),
    status: (input.status ?? "TODO") as TaskStatus,
    priority: (input.priority ?? "MEDIUM") as Priority,
    dueDate: (input.dueDate as string | null | undefined) ?? null,
    startDate: (input.startDate as string | null | undefined) ?? null,
    order: tasks.length,
    parentId: null,
    categoryId: null,
    category: null,
    tags: [],
    assignees: [],
    subtasks: [],
    isRecurring: false,
    recurrence: null,
    createdAt: now,
    updatedAt: now,
    completedAt: (input.completedAt as string | null | undefined) ?? null,
  };

  tasks.unshift(task);
  writeStore(store);
  return cloneTask(task);
}

export function updateLocalTask(
  workspaceId: string,
  taskId: string,
  input: Record<string, unknown>,
): Task {
  const store = readStore();
  const tasks = ensureWorkspaceTasks(store, workspaceId);
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) {
    throw new Error("Task not found");
  }

  const current = tasks[index]!;
  const updated: Task = {
    ...current,
    title: (input.title as string | undefined) ?? current.title,
    description:
      (input.description as string | undefined) ?? current.description,
    status: (input.status as TaskStatus | undefined) ?? current.status,
    priority: (input.priority as Priority | undefined) ?? current.priority,
    dueDate: (input.dueDate as string | null | undefined) ?? current.dueDate,
    startDate:
      (input.startDate as string | null | undefined) ?? current.startDate,
    completedAt:
      (input.completedAt as string | null | undefined) ?? current.completedAt,
    updatedAt: new Date().toISOString(),
  };

  tasks[index] = updated;
  writeStore(store);
  return cloneTask(updated);
}

export function removeLocalTask(workspaceId: string, taskId: string): void {
  const store = readStore();
  const tasks = ensureWorkspaceTasks(store, workspaceId);
  store[workspaceId] = tasks.filter((task) => task.id !== taskId);
  writeStore(store);
}
