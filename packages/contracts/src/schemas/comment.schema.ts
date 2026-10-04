import { z } from "zod";
import { idSchema, namedIdSchema } from "./common.schema";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(5000),
  mentionedUserIds: z.array(idSchema).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(idSchema).optional(),
});

export const commentIdParamsSchema = z.object({
  id: namedIdSchema("ID de comentario inválido"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
