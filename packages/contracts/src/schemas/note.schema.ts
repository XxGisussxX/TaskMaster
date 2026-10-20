import { z } from "zod";
import { NoteType, StickyColor } from "../enums";
import { idSchema, namedIdSchema } from "./common.schema";

export const checklistItemSchema = z.object({
  id: idSchema.optional(),
  text: z.string().trim().min(1).max(500),
  done: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
});

/**
 * Máximo de caracteres del contenido de una nota.
 *
 * Es la única fuente de verdad: el schema del servidor y el form del cliente lo
 * importan para que no vuelvan a divergir (el form permitía 20 000 y el server
 * rechazaba >10 000).
 */
export const MAX_NOTE_CONTENT_CHARS = 10_000;

export const createNoteSchema = z.object({
  type: z.nativeEnum(NoteType),
  title: z.string().trim().max(200).optional(),
  content: z.string().max(MAX_NOTE_CONTENT_CHARS).optional(),
  color: z.nativeEnum(StickyColor).optional(),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  items: z.array(checklistItemSchema).default([]),
  collaborators: z.array(idSchema).default([]),
});

export const updateNoteSchema = createNoteSchema.partial();

export const noteIdParamsSchema = z.object({
  id: namedIdSchema("ID de nota inválido"),
});

export const addChecklistItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const toggleChecklistItemSchema = z.object({
  done: z.boolean(),
});

export const noteFiltersSchema = z.object({
  type: z.nativeEnum(NoteType).optional(),
  search: z.string().max(200).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  pinned: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteFilters = z.infer<typeof noteFiltersSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>;
export type ToggleChecklistItemInput = z.infer<
  typeof toggleChecklistItemSchema
>;
