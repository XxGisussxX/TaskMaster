import { z } from "zod";
import { CustomFieldType } from "../enums";

export const createCustomFieldDefinitionSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(100),
  type: z.nativeEnum(CustomFieldType),
  options: z.array(z.string().trim().min(1).max(100)).optional(),
  order: z.number().int().min(0).optional().default(0),
  required: z.boolean().optional().default(false),
});

export const updateCustomFieldDefinitionSchema =
  createCustomFieldDefinitionSchema.partial();

export const customFieldDefinitionIdParamsSchema = z.object({
  id: z.string().cuid("ID de campo inválido"),
});

export const setCustomFieldValueSchema = z.object({
  definitionId: z.string().cuid("ID de definición inválido"),
  entityId: z.string().cuid("ID de entidad inválido"),
  entityType: z.string().min(1).max(50),
  value: z.unknown(),
});

export const customFieldValueFiltersSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().cuid(),
});

export type CreateCustomFieldDefinitionInput = z.infer<
  typeof createCustomFieldDefinitionSchema
>;
export type UpdateCustomFieldDefinitionInput = z.infer<
  typeof updateCustomFieldDefinitionSchema
>;
export type SetCustomFieldValueInput = z.infer<
  typeof setCustomFieldValueSchema
>;
