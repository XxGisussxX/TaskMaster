import { z } from "zod";

export const savedViewFiltersSchema = z
  .object({
    status: z.string().optional(),
    priority: z.string().optional(),
    search: z.string().optional(),
    onlyMine: z.boolean().optional(),
    onlyOverdue: z.boolean().optional(),
  })
  .passthrough();

export const createSavedViewSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(60),
  filters: savedViewFiltersSchema.default({}),
  view: z.enum(["cards", "table", "board"]).default("cards"),
});

export const updateSavedViewSchema = createSavedViewSchema.partial();

export const savedViewIdParamsSchema = z.object({
  id: z.string().cuid("ID de vista inválido"),
});

export type SavedViewFilters = z.infer<typeof savedViewFiltersSchema>;
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
