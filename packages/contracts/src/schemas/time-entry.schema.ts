import { z } from "zod";
import { idSchema, namedIdSchema } from "./common.schema";

export const createTimeEntrySchema = z.object({
  taskId: namedIdSchema("ID de tarea inválido"),
  description: z.string().max(500).optional().default(""),
  startedAt: z.coerce.date(),
  stoppedAt: z.coerce.date().nullable().optional(),
});

export const updateTimeEntrySchema = z.object({
  description: z.string().max(500).optional(),
  startedAt: z.coerce.date().optional(),
  stoppedAt: z.coerce.date().nullable().optional(),
});

export const timeEntryIdParamsSchema = z.object({
  id: namedIdSchema("ID de entrada inválido"),
});

export const timeEntryFiltersSchema = z.object({
  taskId: idSchema.optional(),
  userId: idSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type TimeEntryFilters = z.infer<typeof timeEntryFiltersSchema>;
