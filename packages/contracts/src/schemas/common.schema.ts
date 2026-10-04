import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Un id es una clave opaca: Prisma genera cuid por defecto, pero nada en el
 * dominio lo exige. Exigir el formato volvía solo-lectura al seed de demo, que
 * usa ids legibles (`seed_task_...`, `workspace_demo`), y el 400 caía en
 * cualquier ruta que validara un id. acá se valida que venga algo, no su forma.
 */
export const idSchema = z.string().min(1, "ID inválido");

/** Igual que {@link idSchema}, con el mensaje que nombra al recurso. */
export const namedIdSchema = (message: string) => z.string().min(1, message);

export function paginatedResponseSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });
}

export type Pagination = z.infer<typeof paginationSchema>;
