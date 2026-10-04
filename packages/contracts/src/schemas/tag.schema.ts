import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const createTagSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(40),
  color: z.string().max(20).nullable().optional(),
});

export const updateTagSchema = createTagSchema.partial();

export const tagIdParamsSchema = z.object({
  id: namedIdSchema("ID de etiqueta inválido"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
