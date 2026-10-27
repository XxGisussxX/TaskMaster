import { z } from "zod";
import { Priority, TaskStatus } from "../enums";

export const nlTaskSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, "Describe la tarea con al menos 5 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
});

export const nlTaskDraftSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200),
  description: z.string().max(5000).default(""),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate debe ser YYYY-MM-DD")
    .nullable()
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate debe ser YYYY-MM-DD")
    .nullable()
    .optional(),
  channelId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  subtasks: z.array(z.string().trim().min(1).max(200)).default([]),
});

export type NlTaskInput = z.infer<typeof nlTaskSchema>;
export type NlTaskDraft = z.infer<typeof nlTaskDraftSchema>;

export const aiUsageSchema = z.object({
  usedToday: z.number().int().min(0),
  dailyLimit: z.number().int().positive(),
});

export type AiUsage = z.infer<typeof aiUsageSchema>;

/**
 * Qué hay operativo del lado del servidor.
 *
 * El frontend consulta esto antes de dibujar el asistente. Sin este contrato
 * había dos opciones malas: mostrar siempre el orbe y que cada mensaje falle con
 * un 503, o duplicar la configuración del servidor en el front con una variable
 * de Vite que puede desincronizarse de la real. El proveedor es opcional en el
 * entorno, así que el caso "no hay key" es el estado por defecto en una
 * instalación nueva y la UI tiene que poder adaptarse a él.
 *
 * No expone la key ni nada derivado de ella: solo si está presente y con qué
 * modelo contaría.
 */
export const aiCapabilitiesSchema = z.object({
  configured: z.boolean(),
  model: z.string().min(1),
  dailyLimit: z.number().int().positive(),
});

export type AiCapabilities = z.infer<typeof aiCapabilitiesSchema>;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

export const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).max(20),
  text: z.string().trim().min(1).max(2000),
});

export const assistantTaskRefSchema = z.object({
  taskId: z.string(),
  taskTitle: z.string().trim().min(1).max(200),
});

export const assistantCompleteActionSchema = z.object({
  kind: z.literal("complete"),
  taskId: z.string(),
  taskTitle: z.string().trim().min(1).max(200),
});

/**
 * Completar varias tareas en una sola acción.
 *
 * Se modela como un lote (y no como N acciones `complete`) para que el usuario
 * confirme una sola vez y el frontend haga un único `bulk/status`. El tope de 20
 * coincide con `ASSISTANT_BATCH_LIMIT` del dominio y evita respuestas enormes.
 */
export const assistantCompleteManyActionSchema = z.object({
  kind: z.literal("complete-many"),
  tasks: z.array(assistantTaskRefSchema).min(1).max(20),
});

export const assistantDeleteActionSchema = z.object({
  kind: z.literal("delete"),
  taskId: z.string(),
  taskTitle: z.string().trim().min(1).max(200),
});

export const assistantDeleteManyActionSchema = z.object({
  kind: z.literal("delete-many"),
  tasks: z.array(assistantTaskRefSchema).min(1).max(20),
});

/**
 * Crear una tarea con el mismo borrador que produce el flujo de lenguaje
 * natural, para que el usuario revise antes de confirmar.
 */
export const assistantCreateActionSchema = z.object({
  kind: z.literal("create"),
  draft: nlTaskDraftSchema,
});

export const assistantReminderActionSchema = z.object({
  kind: z.literal("reminder"),
  title: z.string().trim().min(1).max(200),
  triggerAt: z.string().datetime({ offset: true }),
  taskId: z.string().nullable().optional(),
  taskTitle: z.string().trim().min(1).max(200).nullable().optional(),
});

export const assistantActionSchema = z.discriminatedUnion("kind", [
  assistantCompleteActionSchema,
  assistantCompleteManyActionSchema,
  assistantDeleteActionSchema,
  assistantDeleteManyActionSchema,
  assistantCreateActionSchema,
  assistantReminderActionSchema,
]);

export const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  actions: z.array(assistantActionSchema).max(10).default([]),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantTaskRef = z.infer<typeof assistantTaskRefSchema>;
export type AssistantCompleteAction = z.infer<
  typeof assistantCompleteActionSchema
>;
export type AssistantCompleteManyAction = z.infer<
  typeof assistantCompleteManyActionSchema
>;
export type AssistantDeleteAction = z.infer<typeof assistantDeleteActionSchema>;
export type AssistantDeleteManyAction = z.infer<
  typeof assistantDeleteManyActionSchema
>;
export type AssistantCreateAction = z.infer<typeof assistantCreateActionSchema>;
export type AssistantReminderAction = z.infer<
  typeof assistantReminderActionSchema
>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

/**
 * Un turno del historial del asistente persistido en el servidor.
 *
 * `actions` replica lo que devolvió `AssistantResponse.actions`, para que al
 * recargar la página se puedan reconstruir los botones de acción en su estado
 * inicial (`pending`). El estado "ejecutada" no se persiste: se resuelve contra
 * el estado real de la tarea/recordatorio al volver a montar.
 */
export const aiChatEntrySchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  actions: z.array(assistantActionSchema).default([]),
  createdAt: z.string().datetime({ offset: true }),
});

export const aiChatHistorySchema = z.object({
  entries: z.array(aiChatEntrySchema),
});

export type AiChatEntry = z.infer<typeof aiChatEntrySchema>;
export type AiChatHistory = z.infer<typeof aiChatHistorySchema>;
