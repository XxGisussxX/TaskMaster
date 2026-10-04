import { z } from "zod";
import { Priority, TaskStatus, RecurrenceFrequency } from "../enums";
import { idSchema, namedIdSchema } from "./common.schema";

export const recurrenceSchema = z
  .object({
    frequency: z.nativeEnum(RecurrenceFrequency),
    interval: z.number().int().min(1).max(365).default(1),
    endDate: z.coerce.date().optional(),
  })
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200),
  description: z.string().max(5000).optional().default(""),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  parentId: idSchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  tagIds: z.array(idSchema).default([]),
  assigneeIds: z.array(idSchema).default([]),
  isRecurring: z.boolean().default(false),
  recurrence: recurrenceSchema,
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .omit({ tagIds: true, assigneeIds: true });

export const taskIdParamsSchema = z.object({
  id: namedIdSchema("ID de tarea inválido"),
});

export const taskFiltersSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  search: z.string().max(200).optional(),
  tagId: idSchema.optional(),
  assigneeId: idSchema.optional(),
  categoryId: idSchema.optional(),
  onlyOverdue: z.coerce.boolean().optional(),
  onlyMine: z.coerce.boolean().optional(),
  parentId: idSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

export const setTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

const bulkTaskIds = z
  .array(idSchema)
  .min(1, "Selecciona al menos una tarea")
  .max(100, "Máximo 100 tareas por operación");

export const bulkUpdateStatusSchema = z.object({
  ids: bulkTaskIds,
  status: z.nativeEnum(TaskStatus),
});

export const bulkUpdatePrioritySchema = z.object({
  ids: bulkTaskIds,
  priority: z.nativeEnum(Priority),
});

export const bulkDeleteSchema = z.object({
  ids: bulkTaskIds,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type SetTaskStatusInput = z.infer<typeof setTaskStatusSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
export type BulkUpdatePriorityInput = z.infer<typeof bulkUpdatePrioritySchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
