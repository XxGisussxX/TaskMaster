import { z } from "zod";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(5000),
  mentionedUserIds: z.array(z.string().cuid()).optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(z.string().cuid()).optional(),
});

export const commentIdParamsSchema = z.object({
  id: z.string().cuid("ID de comentario inválido"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
