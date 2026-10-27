import { describe, expect, it } from "vitest";
import { buildProactiveMessage } from "./assistantScript";

/**
 * El mensaje proactivo elige una frase al azar de un pool. Antes cada variante
 * tenía el singular o el plural fijo, así que con 13 vencidas salía "13 tarea
 * vencida". Estos tests fijan que cualquier variante respete el número real.
 */
describe("buildProactiveMessage", () => {
  it("pluraliza las tareas vencidas con el número real", () => {
    const message = buildProactiveMessage({
      activeTasks: 13,
      overdueTasks: 13,
      completedToday: 0,
    });

    expect(message).toContain("13 tareas vencidas");
    expect(message).not.toContain("13 tarea vencida");
    expect(message).not.toContain("{tareaVencida}");
  });

  it("usa singular cuando hay una sola vencida", () => {
    const message = buildProactiveMessage({
      activeTasks: 1,
      overdueTasks: 1,
      completedToday: 0,
    });

    expect(message).toContain("1 tarea vencida");
    expect(message).not.toContain("1 tareas");
  });

  it("pluraliza las completadas del día", () => {
    const message = buildProactiveMessage({
      activeTasks: 3,
      overdueTasks: 0,
      completedToday: 2,
    });

    expect(message).toContain("2 tareas completadas");
    expect(message).not.toContain("{n}");
    expect(message).not.toContain("{tareaCompletada}");
  });
});
