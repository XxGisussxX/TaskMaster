import { z } from "zod";
import { ReminderRepeat } from "../enums";
import { idSchema } from "./common.schema";

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200),
  triggerAt: z.coerce.date(),
  repeat: z.nativeEnum(ReminderRepeat).default(ReminderRepeat.NONE),
  taskId: idSchema.nullable().optional(),
  noteId: idSchema.nullable().optional(),
});

export const updateReminderSchema = createReminderSchema.partial();

export const reminderFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type ReminderFilters = z.infer<typeof reminderFiltersSchema>;
