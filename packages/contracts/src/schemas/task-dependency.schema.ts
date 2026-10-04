import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const createTaskDependencySchema = z.object({
  fromTaskId: namedIdSchema("ID de tarea inválido"),
  toTaskId: namedIdSchema("ID de tarea inválido"),
});

export const taskDependencyIdParamsSchema = z.object({
  id: namedIdSchema("ID de dependencia inválido"),
});

export type CreateTaskDependencyInput = z.infer<
  typeof createTaskDependencySchema
>;
