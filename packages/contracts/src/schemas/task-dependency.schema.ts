import { z } from "zod";

export const createTaskDependencySchema = z.object({
  fromTaskId: z.string().cuid("ID de tarea inválido"),
  toTaskId: z.string().cuid("ID de tarea inválido"),
});

export const taskDependencyIdParamsSchema = z.object({
  id: z.string().cuid("ID de dependencia inválido"),
});

export type CreateTaskDependencyInput = z.infer<
  typeof createTaskDependencySchema
>;
