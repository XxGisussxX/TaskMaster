import { z } from "zod";
import { Priority, TaskStatus } from "../enums";

export const agendaFindingKind = {
  /** Dos tareas del mismo responsable con ventanas que se pisan. */
  OVERLAP: "OVERLAP",
  /** Un día con más tareas de las que la jornada soporta. */
  OVERLOAD: "OVERLOAD",
  /** `IN_REVIEW` que nadie cerró. */
  STALE_REVIEW: "STALE_REVIEW",
  /** Vencida y sin escalar a `URGENT`. */
  UNFLAGGED_OVERDUE: "UNFLAGGED_OVERDUE",
} as const;
export type AgendaFindingKind =
  (typeof agendaFindingKind)[keyof typeof agendaFindingKind];

export const agendaReviewQuerySchema = z.object({
  /** Cuántas tareas se consideran asumibles en un día. */
  dailyCapacity: z.coerce.number().int().positive().max(50).optional(),
  horizonDays: z.coerce.number().int().positive().max(90).optional(),
});
export type AgendaReviewQuery = z.infer<typeof agendaReviewQuerySchema>;

export const agendaFindingSchema = z.object({
  kind: z.nativeEnum(agendaFindingKind),
  severity: z.number().int().min(0),
  taskIds: z.array(z.string().min(1)),
  message: z.string().min(1),
});

export type AgendaFinding = z.infer<typeof agendaFindingSchema>;

export const agendaReviewSchema = z.object({
  findings: z.array(agendaFindingSchema),
  overloadedDays: z.array(
    z.object({ date: z.string(), count: z.number().int().nonnegative() }),
  ),
  generatedAt: z.string(),
  /** Tareas abiertas que entraron en el análisis, para que la UI pueda escalar. */
  analyzedTasks: z.number().int().nonnegative(),
});

export type AgendaReview = z.infer<typeof agendaReviewSchema>;

/** Tarea en la forma mínima que consume la revisión. */
export const agendaTaskSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().nullable(),
  startDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  assignees: z.array(z.object({ id: z.string().min(1) })),
});
export type AgendaTask = z.infer<typeof agendaTaskSchema>;
