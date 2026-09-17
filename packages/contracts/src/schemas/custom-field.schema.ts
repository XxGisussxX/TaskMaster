import { z } from "zod";
import { CustomFieldType } from "../enums";
import type { CustomFieldType as TCustomFieldType } from "../enums";

export const createCustomFieldDefinitionSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(100),
  type: z.nativeEnum(CustomFieldType),
  options: z.array(z.string().trim().min(1).max(100)).optional(),
  order: z.number().int().min(0).optional().default(0),
  required: z.boolean().optional().default(false),
});

export const updateCustomFieldDefinitionSchema =
  createCustomFieldDefinitionSchema.partial();

export const reorderCustomFieldDefinitionsSchema = z.object({
  orderedIds: z.array(z.string().cuid("ID de campo inválido")).min(1),
});

export const customFieldDefinitionIdParamsSchema = z.object({
  id: z.string().cuid("ID de campo inválido"),
});

export const setCustomFieldValueSchema = z.object({
  definitionId: z.string().cuid("ID de definición inválido"),
  entityId: z.string().cuid("ID de entidad inválido"),
  entityType: z
    .enum(["task", "note"], {
      message: "entityType debe ser task o note",
    })
    .default("task"),
  value: z.unknown(),
});

export const customFieldValueFiltersSchema = z.object({
  entityType: z
    .enum(["task", "note"], { message: "entityType debe ser task o note" })
    .default("task"),
  entityId: z.string().cuid(),
});

export const customFieldValuesManySchema = z.object({
  entityType: z
    .enum(["task", "note"], { message: "entityType debe ser task o note" })
    .default("task"),
  entityIds: z.array(z.string().cuid("ID de entidad inválido")).min(1).max(100),
});

/** Datos mínimos que necesita `parseCustomFieldValue` para validar un valor. */
export interface CustomFieldValueLike {
  type: TCustomFieldType;
  required?: boolean;
  options?: string[];
}

export type CustomFieldValueByType = {
  [
    K in (typeof CustomFieldType)[keyof typeof CustomFieldType]
  ]: K extends "TEXT"
    ? string
    : K extends "NUMBER"
      ? number
      : K extends "DATE"
        ? string
        : K extends "SELECT"
          ? string
          : K extends "MULTI_SELECT"
            ? string[]
            : boolean;
};

type ParseResult<T> =
  { success: true; value: T } | { success: false; message: string };

function emptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function checkRequired(def: CustomFieldValueLike, label: string) {
  if (!def.required) return null;
  return {
    success: false,
    message: `El campo «${label}» es requerido`,
  } as const;
}

/**
 * Valida un valor contra la definición de un campo personalizado.
 * Fuente única de verdad de los shapes (uso backend y frontend).
 */
export function parseCustomFieldValue(
  input: { value: unknown } | unknown,
  opts: {
    def?: CustomFieldValueLike;
    label?: string;
    checkRequired?: boolean;
  } = {},
): ParseResult<CustomFieldValueByType[TCustomFieldType]> {
  const rawValue =
    input && typeof input === "object" && "value" in input
      ? (input as { value: unknown }).value
      : (input as unknown);
  const def = opts.def ?? {
    type: "TEXT" as TCustomFieldType,
    required: false,
    options: [],
  };
  const label = opts.label ?? "Campo personalizado";

  if (emptyValue(rawValue)) {
    const requiredError = opts.checkRequired && checkRequired(def, label);
    if (requiredError) return requiredError;
    return { success: true, value: undefined as never };
  }

  switch (def.type) {
    case "TEXT":
      return typeof rawValue === "string"
        ? { success: true, value: rawValue }
        : { success: false, message: `«${label}» debe ser texto` };

    case "NUMBER": {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        return { success: true, value: rawValue };
      }
      return { success: false, message: `«${label}» debe ser un número` };
    }

    case "DATE":
      return typeof rawValue === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
        ? { success: true, value: rawValue }
        : { success: false, message: `«${label}» debe ser una fecha válida` };

    case "SELECT": {
      if (typeof rawValue !== "string") {
        return { success: false, message: `«${label}» debe elegir una opción` };
      }
      const options = def.options ?? [];
      if (options.length > 0 && !options.includes(rawValue)) {
        return {
          success: false,
          message: `«${label}» debe ser una de las opciones definidas`,
        };
      }
      return { success: true, value: rawValue };
    }

    case "MULTI_SELECT": {
      if (!Array.isArray(rawValue)) {
        return {
          success: false,
          message: `«${label}» debe ser una lista de opciones`,
        };
      }
      const options = def.options ?? [];
      const isValid = rawValue.every(
        (item) =>
          typeof item === "string" &&
          (options.length === 0 || options.includes(item)),
      );
      const noDuplicates = new Set(rawValue).size === rawValue.length;
      if (!isValid || !noDuplicates) {
        return {
          success: false,
          message: `«${label}» contiene opciones no válidas o repetidas`,
        };
      }
      return { success: true, value: rawValue as string[] };
    }

    case "CHECKBOX":
      return typeof rawValue === "boolean"
        ? { success: true, value: rawValue }
        : { success: false, message: `«${label}» debe ser un valor booleano` };

    default:
      return {
        success: false,
        message: `Tipo de campo «${label}» no soportado`,
      };
  }
}

export type CreateCustomFieldDefinitionInput = z.infer<
  typeof createCustomFieldDefinitionSchema
>;
export type UpdateCustomFieldDefinitionInput = z.infer<
  typeof updateCustomFieldDefinitionSchema
>;
export type ReorderCustomFieldDefinitionsInput = z.infer<
  typeof reorderCustomFieldDefinitionsSchema
>;
export type SetCustomFieldValueInput = z.infer<
  typeof setCustomFieldValueSchema
>;
export type CustomFieldValuesManyInput = z.infer<
  typeof customFieldValuesManySchema
>;
