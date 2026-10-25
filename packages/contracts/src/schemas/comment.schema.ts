import { z } from "zod";
import { idSchema, namedIdSchema } from "./common.schema";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(1000, "El comentario no puede superar los 1000 caracteres"),
  mentionedUserIds: z.array(idSchema).optional(),
});

export const updateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(1000, "El comentario no puede superar los 1000 caracteres"),
  mentionedUserIds: z.array(idSchema).optional(),
});

export const commentIdParamsSchema = z.object({
  id: namedIdSchema("ID de comentario inválido"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
