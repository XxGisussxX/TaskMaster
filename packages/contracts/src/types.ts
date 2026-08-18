import type {
  Priority,
  TaskStatus,
  NoteType,
  StickyColor,
  WorkspaceRole,
  SystemRole,
  RecurrenceFrequency,
  ReminderRepeat,
  NotificationType,
  EntityType,
  Action,
} from "./enums";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: SystemRole;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  user?: Pick<User, "id" | "name" | "email" | "avatarUrl">;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  creatorId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  startDate: string | null;
  order: number;
  parentId: string | null;
  categoryId: string | null;
  category?: { id: string; name: string; color: string | null } | null;
  tags: { id: string; name: string; color: string | null }[];
  assignees: Pick<User, "id" | "name" | "email" | "avatarUrl">[];
  subtasks: Task[];
  isRecurring: boolean;
  recurrence: Recurrence | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string | null;
}

export interface ChecklistItemDto {
  id?: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Note {
  id: string;
  workspaceId: string;
  authorId: string;
  type: NoteType;
  title: string | null;
  content: string | null;
  color: StickyColor | null;
  pinned: boolean;
  tags: { id: string; name: string; color: string | null }[];
  items: ChecklistItemDto[];
  collaborators: Pick<User, "id" | "name" | "email" | "avatarUrl">[];
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  workspaceId: string;
  userId: string;
  taskId: string | null;
  noteId: string | null;
  title: string;
  triggerAt: string;
  sentAt: string | null;
  repeat: ReminderRepeat;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  user?: Pick<User, "id" | "name" | "avatarUrl">;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  workspaceId: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  action: Action;
  changes: { field: string; old: unknown; new: unknown }[] | null;
  user?: Pick<User, "id" | "name" | "avatarUrl">;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface DashboardStats {
  kpis: {
    activeTasks: number;
    completedToday: number;
    overdueTasks: number;
    avgCompletionDays: number;
    completionRate: number;
  };
  createdCompletedSeries: {
    date: string;
    created: number;
    completed: number;
  }[];
  priorityDistribution: Record<Priority, number>;
  statusDistribution: Record<TaskStatus, number>;
  activity: ActivityEntry[];
}

export interface BulkActionResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SavedView {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  view: "cards" | "table" | "board";
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  workspaceId: string;
  taskId: string | null;
  noteId: string | null;
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: string;
}
