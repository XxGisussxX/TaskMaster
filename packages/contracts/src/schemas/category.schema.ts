import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(40),
  color: z.string().max(20).nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryIdParamsSchema = z.object({
  id: z.string().cuid("ID de categoría inválido"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
