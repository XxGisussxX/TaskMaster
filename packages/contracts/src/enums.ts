export const SystemRole = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
  ARCHIVED: "ARCHIVED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const StickyColor = {
  YELLOW: "YELLOW",
  PINK: "PINK",
  BLUE: "BLUE",
  GREEN: "GREEN",
} as const;
export type StickyColor = (typeof StickyColor)[keyof typeof StickyColor];

export const NoteType = {
  STANDARD: "STANDARD",
  CHECKLIST: "CHECKLIST",
  IDEA: "IDEA",
  MEETING: "MEETING",
  STICKY: "STICKY",
} as const;
export type NoteType = (typeof NoteType)[keyof typeof NoteType];

export const ReminderRepeat = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;
export type ReminderRepeat =
  (typeof ReminderRepeat)[keyof typeof ReminderRepeat];

export const RecurrenceFrequency = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type RecurrenceFrequency =
  (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export const NotificationType = {
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_COMPLETED: "TASK_COMPLETED",
  DUE_SOON: "DUE_SOON",
  MENTION: "MENTION",
  REMINDER: "REMINDER",
  WORKSPACE_INVITE: "WORKSPACE_INVITE",
  NOTE_SHARED: "NOTE_SHARED",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const Action = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  COMPLETED: "COMPLETED",
  REOPENED: "REOPENED",
  DELETED: "DELETED",
  ASSIGNED: "ASSIGNED",
  STATUS_CHANGED: "STATUS_CHANGED",
  COMMENTED: "COMMENTED",
} as const;
export type Action = (typeof Action)[keyof typeof Action];

export const EntityType = {
  TASK: "TASK",
  NOTE: "NOTE",
  REMINDER: "REMINDER",
  MEMBER: "MEMBER",
  WORKSPACE: "WORKSPACE",
  COMMENT: "COMMENT",
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const Theme = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

export const DependencyType = {
  BLOCKS: "BLOCKS",
  BLOCKED_BY: "BLOCKED_BY",
} as const;
export type DependencyType =
  (typeof DependencyType)[keyof typeof DependencyType];

export const CustomFieldType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  DATE: "DATE",
  SELECT: "SELECT",
  MULTI_SELECT: "MULTI_SELECT",
  CHECKBOX: "CHECKBOX",
} as const;
export type CustomFieldType =
  (typeof CustomFieldType)[keyof typeof CustomFieldType];
