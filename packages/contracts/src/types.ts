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
  CustomFieldType,
} from "./enums";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: SystemRole;
  isEmailVerified: boolean;
  /** Indica si el usuario tiene contraseña establecida (cuenta local). */
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  /** Presente en el detalle de miembros (`GET /workspaces/:id/members`). */
  createdAt?: string;
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

export interface Invite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: Pick<User, "id" | "name"> | null;
  expiresAt: string;
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
  mentionedUserIds?: string[];
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
  user?: Pick<User, "id" | "name" | "email" | "avatarUrl">;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  /**
   * El servidor ya no lo manda en el cuerpo: viaja en una cookie HttpOnly.
   * Vive en el tipo porque es lo que devuelve `AuthService`, que es donde se
   * emite; el controller lo saca de la respuesta con `withoutRefreshToken`.
   */
  refreshToken: string;
  expiresIn: number;
  user: User;
}

/** Lo que vuelve al cliente: la sesión sin el refresh token. */
export type AuthSessionResponse = Omit<AuthSession, "refreshToken">;

export interface KpiTrend {
  date: string;
  active: number;
  completed: number;
  overdue: number;
  avgCompletionDays: number;
}

export interface DashboardStats {
  kpis: {
    activeTasks: number;
    completedToday: number;
    overdueTasks: number;
    avgCompletionDays: number;
    completionRate: number;
  };
  kpiTrends: KpiTrend[];
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

export interface TaskDependency {
  id: string;
  workspaceId: string;
  fromTaskId: string;
  toTaskId: string;
  fromTask?: Pick<Task, "id" | "title" | "status" | "priority">;
  toTask?: Pick<Task, "id" | "title" | "status" | "priority">;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  description: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  duration: number | null;
  user?: Pick<User, "id" | "name" | "avatarUrl">;
  createdAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  order: number;
  required: boolean;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  definitionId: string;
  entityId: string;
  entityType: string;
  value: unknown;
  definition?: CustomFieldDefinition;
  createdAt: string;
}
