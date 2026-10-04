import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const createTaskTemplateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(100),
  description: z.string().max(500).optional().default(""),
  data: z.record(z.unknown()),
});

export const updateTaskTemplateSchema = createTaskTemplateSchema.partial();

export const taskTemplateIdParamsSchema = z.object({
  id: namedIdSchema("ID de plantilla inválido"),
});

export type CreateTaskTemplateInput = z.infer<typeof createTaskTemplateSchema>;
export type UpdateTaskTemplateInput = z.infer<typeof updateTaskTemplateSchema>;
