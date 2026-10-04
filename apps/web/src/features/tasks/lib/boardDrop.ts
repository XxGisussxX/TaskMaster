import { TaskStatus, type Task } from "@taskmaster/contracts";

const STATUSES = new Set<string>(Object.values(TaskStatus));

export function isTaskStatus(value: string): value is TaskStatus {
  return STATUSES.has(value);
}

/**
 * Resuelve a qué columna lleva una tarjeta soltada en el board.
 *
 * `over.id` es el id de la columna cuando se suelta en su espacio vacío, pero
 * cada tarjeta también es droppable (`useSortable`), así que soltar sobre otra
 * tarjeta devuelve el id de esa tarjeta. Ese caso significa "mover a la columna
 * de esa tarjeta".
 *
 * Devuelve `null` cuando no se puede resolver: antes se hacía `over.id as
 * TaskStatus`, un cast que el compilador aceptaba y que mandaba un id de tarea
 * como `status`, que la API rechazaba con 400.
 */
export function resolveDropStatus(
  overId: string,
  tasks: Task[],
): TaskStatus | null {
  if (isTaskStatus(overId)) return overId;
  return tasks.find((task) => task.id === overId)?.status ?? null;
}
