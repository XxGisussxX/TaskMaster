import { z } from "zod";
import { Priority, TaskStatus } from "../enums";

export const nlTaskSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, "Describe la tarea con al menos 5 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
});

export const nlTaskDraftSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200),
  description: z.string().max(5000).default(""),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate debe ser YYYY-MM-DD")
    .nullable()
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate debe ser YYYY-MM-DD")
    .nullable()
    .optional(),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  subtasks: z.array(z.string().trim().min(1).max(200)).default([]),
});

export type NlTaskInput = z.infer<typeof nlTaskSchema>;
export type NlTaskDraft = z.infer<typeof nlTaskDraftSchema>;

export const aiUsageSchema = z.object({
  usedToday: z.number().int().min(0),
  dailyLimit: z.number().int().positive(),
});

export type AiUsage = z.infer<typeof aiUsageSchema>;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

export const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).max(20),
  text: z.string().trim().min(1).max(2000),
});

export const assistantCompleteActionSchema = z.object({
  kind: z.literal("complete"),
  taskId: z.string(),
  taskTitle: z.string().trim().min(1).max(200),
});

export const assistantReminderActionSchema = z.object({
  kind: z.literal("reminder"),
  title: z.string().trim().min(1).max(200),
  triggerAt: z.string().datetime({ offset: true }),
  taskId: z.string().nullable().optional(),
  taskTitle: z.string().trim().min(1).max(200).nullable().optional(),
});

export const assistantActionSchema = z.discriminatedUnion("kind", [
  assistantCompleteActionSchema,
  assistantReminderActionSchema,
]);

export const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  actions: z.array(assistantActionSchema).max(3).default([]),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantCompleteAction = z.infer<
  typeof assistantCompleteActionSchema
>;
export type AssistantReminderAction = z.infer<
  typeof assistantReminderActionSchema
>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
