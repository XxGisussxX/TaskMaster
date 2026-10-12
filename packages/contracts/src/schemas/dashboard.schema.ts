import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (se espera YYYY-MM-DD)");

/**
 * Query del dashboard. `from`/`to` definen la ventana de las series y se
 * validan como fechas locales (YYYY-MM-DD); `to` por defecto es hoy y `from`
 * 29 días antes. `year` selecciona el año del heatmap (por defecto, el actual).
 */
export const dashboardQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "`from` debe ser anterior o igual a `to`",
    path: ["from"],
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
