import { describe, expect, it } from "vitest";
import { TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { isTaskStatus, resolveDropStatus } from "./boardDrop";

function task(id: string, status: TaskStatus): Task {
  return { id, status } as Task;
}

const tasks: Task[] = [
  task("seed_task_a", TaskStatus.TODO),
  task("seed_task_b", TaskStatus.IN_PROGRESS),
];

describe("isTaskStatus", () => {
  it("acepta los cinco estados del board", () => {
    for (const status of Object.values(TaskStatus)) {
      expect(isTaskStatus(status)).toBe(true);
    }
  });

  it("rechaza un id de tarea, que es lo que llega al soltar sobre una tarjeta", () => {
    expect(isTaskStatus("seed_task_a")).toBe(false);
  });
});

describe("resolveDropStatus", () => {
  it("devuelve la columna cuando se suelta en su espacio vacío", () => {
    expect(resolveDropStatus(TaskStatus.DONE, tasks)).toBe(TaskStatus.DONE);
    expect(resolveDropStatus("ARCHIVED", tasks)).toBe(TaskStatus.ARCHIVED);
  });

  it("devuelve la columna de la tarjeta sobre la que se solta", () => {
    expect(resolveDropStatus("seed_task_b", tasks)).toBe(
      TaskStatus.IN_PROGRESS,
    );
  });

  it("devuelve null si no puede resolver, para no mandar una petición inválida", () => {
    expect(resolveDropStatus("seed_task_inexistente", tasks)).toBeNull();
    expect(resolveDropStatus("WORKFLOW", tasks)).toBeNull();
    expect(resolveDropStatus("", tasks)).toBeNull();
  });

  it("nunca devuelve un id de tarea como estado", () => {
    const status = resolveDropStatus("seed_task_a", tasks);
    expect(status).toBe(TaskStatus.TODO);
    expect(isTaskStatus(status!)).toBe(true);
  });
});
