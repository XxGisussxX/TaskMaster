import { describe, expect, it } from "vitest";
import {
  aiUsageSchema,
  nlTaskDraftSchema,
  nlTaskSchema,
} from "@taskmaster/contracts";

describe("nlTaskSchema", () => {
  it("acepta un texto válido", () => {
    expect(nlTaskSchema.parse({ text: "Preparar la presentación" })).toEqual({
      text: "Preparar la presentación",
    });
  });

  it("recorta espacios del texto", () => {
    expect(nlTaskSchema.parse({ text: "  Tarea  " })).toEqual({
      text: "Tarea",
    });
  });

  it("rechaza textos cortos", () => {
    expect(nlTaskSchema.safeParse({ text: "hola" }).success).toBe(false);
  });

  it("rechaza textos demasiado largos", () => {
    expect(nlTaskSchema.safeParse({ text: "a".repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe("nlTaskDraftSchema", () => {
  it("aplica defaults para los campos opcionales", () => {
    const draft = nlTaskDraftSchema.parse({ title: "Título" });
    expect(draft.description).toBe("");
    expect(draft.tagIds).toEqual([]);
    expect(draft.subtasks).toEqual([]);
  });

  it("valida el formato YYYY-MM-DD de las fechas", () => {
    expect(
      nlTaskDraftSchema.safeParse({ title: "x", dueDate: "18-09-2026" })
        .success,
    ).toBe(false);
    expect(
      nlTaskDraftSchema.safeParse({ title: "x", dueDate: "2026-09-18" })
        .success,
    ).toBe(true);
  });

  it("validates status y priority contra los enums", () => {
    expect(
      nlTaskDraftSchema.safeParse({
        title: "x",
        status: "NOPE",
        priority: "URGENT",
      }).success,
    ).toBe(false);
    expect(
      nlTaskDraftSchema.safeParse({
        title: "x",
        status: "IN_PROGRESS",
        priority: "URGENT",
      }).success,
    ).toBe(true);
  });

  it("acepta null en las fechas y categoryId", () => {
    const draft = nlTaskDraftSchema.parse({
      title: "x",
      dueDate: null,
      startDate: null,
      categoryId: null,
    });
    expect(draft.dueDate).toBeNull();
    expect(draft.categoryId).toBeNull();
  });
});

describe("aiUsageSchema", () => {
  it("acepta un uso válido", () => {
    expect(aiUsageSchema.parse({ usedToday: 3, dailyLimit: 15 })).toEqual({
      usedToday: 3,
      dailyLimit: 15,
    });
  });

  it("rechaza valores negativos o límites inválidos", () => {
    expect(
      aiUsageSchema.safeParse({ usedToday: -1, dailyLimit: 15 }).success,
    ).toBe(false);
    expect(
      aiUsageSchema.safeParse({ usedToday: 0, dailyLimit: 0 }).success,
    ).toBe(false);
  });
});
