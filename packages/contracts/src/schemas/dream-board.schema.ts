import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const DreamPinType = {
  GOAL: "GOAL",
  PROJECT: "PROJECT",
  LEARNING: "LEARNING",
  TRAVEL: "TRAVEL",
  FINANCIAL: "FINANCIAL",
  HEALTH: "HEALTH",
} as const;
export type DreamPinType = (typeof DreamPinType)[keyof typeof DreamPinType];

/** Paleta fija del tablero: los 6 colores del selector de la UI. */
export const DreamPinColor = {
  AMBER: "AMBER",
  ROSE: "ROSE",
  SKY: "SKY",
  EMERALD: "EMERALD",
  VIOLET: "VIOLET",
  SLATE: "SLATE",
} as const;
export type DreamPinColor = (typeof DreamPinColor)[keyof typeof DreamPinColor];

export const dreamPinTypeSchema = z.enum([
  "GOAL",
  "PROJECT",
  "LEARNING",
  "TRAVEL",
  "FINANCIAL",
  "HEALTH",
]);

export const dreamPinColorSchema = z.enum([
  "AMBER",
  "ROSE",
  "SKY",
  "EMERALD",
  "VIOLET",
  "SLATE",
]);

/**
 * Coordenadas absolutas en el corcho, en px.
 *
 * Un `z.number().finite()` solo descartaba `NaN`/`Infinity`: nada impedía
 * guardar un millón de píxeles (o cualquier valor arbitrario) desde el API.
 * El rango es amplio de sobra para un corcho de arrastrar-soltar y también
 * acepta posiciones negativas (arrastrar a la izquierda del origen).
 */
const positionSchema = z.number().finite().min(-10_000).max(10_000);

export const createPinSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es requerido")
    .max(120, "El título es demasiado largo"),
  type: dreamPinTypeSchema.default("GOAL"),
  color: dreamPinColorSchema.default("AMBER"),
  description: z
    .string()
    .trim()
    .max(1000, "La descripción es demasiado larga")
    .default(""),
  x: positionSchema.default(0),
  y: positionSchema.default(0),
});

export const createDreamPinSchema = z.object({
  title: z.string().trim().min(1),
  type: dreamPinTypeSchema,
  color: dreamPinColorSchema,
  description: z.string().trim().max(1000).optional().default(""),
  positionX: positionSchema,
  positionY: positionSchema,
  imageUrl: z.string().url().optional(),
  sticker: z.string().max(10).optional(),
  linkedTaskId: namedIdSchema("ID de tarea inválido").optional(),
});

export type CreateDreamPinInput = z.infer<typeof createDreamPinSchema>;

/**
 * Actualización parcial. Además de los campos del pin acepta `{ x, y }` para el
 * drag & drop y `{ title: "" }` es inválido: un pin siempre tiene título.
 */
export const updatePinSchema = z
  .object({
    title: createPinSchema.shape.title.optional(),
    type: dreamPinTypeSchema.optional(),
    color: dreamPinColorSchema.optional(),
    description: z.string().trim().max(1000).optional(),
    x: positionSchema.optional(),
    y: positionSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No hay cambios para guardar",
  });

/**
 * Actualización parcial de un pin.
 *
 * Semántica de los campos opcionales: un campo **ausente** (`undefined`) no se
 * toca; un campo enviado como `null` (o cadena vacía, que el servicio normaliza
 * a `null`) borra el valor a propósito. Antes, la ausencia de `imageUrl`,
 * `sticker` o `linkedTaskId` se interpretaba como borrado, así que arrastrar un
 * pin con `{ positionX, positionY }` destruía esos tres campos.
 *
 * El `.refine` exige al menos un campo: un `PATCH {}` es un 400, no un no-op.
 */
export const updateDreamPinSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    type: dreamPinTypeSchema.optional(),
    color: dreamPinColorSchema.optional(),
    description: z.string().trim().max(1000).optional(),
    positionX: positionSchema.optional(),
    positionY: positionSchema.optional(),
    imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    sticker: z.union([z.string().max(10), z.literal(""), z.null()]).optional(),
    // Mismo criterio que `createDreamPinSchema`: la forma del id no la exige
    // nadie (el seed usa ids legibles). Exigir `.cuid()` hacía que un pin
    // enlazado a una tarea del seed no se pudiera re-vincular.
    linkedTaskId: namedIdSchema("ID de tarea inválido").nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No hay cambios para guardar",
  });

export type UpdateDreamPinInput = z.infer<typeof updateDreamPinSchema>;

export const pinIdParamsSchema = z.object({
  id: namedIdSchema("ID de pin inválido"),
});

export type CreatePinInput = z.infer<typeof createPinSchema>;
export type UpdatePinInput = z.infer<typeof updatePinSchema>;

export interface DreamPinDto {
  id: string;
  boardId: string;
  title: string;
  description: string;
  type: DreamPinType;
  color: DreamPinColor;
  x: number;
  y: number;
  imageUrl?: string | null;
  sticker?: string | null;
  linkedTaskId?: string | null;
  linkedTask?: {
    id: string;
    title: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DreamBoardDto {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pins: DreamPinDto[];
}
