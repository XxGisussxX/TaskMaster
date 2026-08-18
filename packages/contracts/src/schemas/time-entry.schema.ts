import { z } from "zod";

export const createTimeEntrySchema = z.object({
  taskId: z.string().cuid("ID de tarea inválido"),
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
  id: z.string().cuid("ID de entrada inválido"),
});

export const timeEntryFiltersSchema = z.object({
  taskId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type TimeEntryFilters = z.infer<typeof timeEntryFiltersSchema>;
