import { describe, expect, it } from "vitest";
import {
  agendaFindingSchema,
  agendaReviewQuerySchema,
  agendaReviewSchema,
} from "@taskmaster/contracts";

describe("agendaReviewQuerySchema", () => {
  it("acepta una query vacía", () => {
    expect(agendaReviewQuerySchema.parse({})).toEqual({});
  });

  it("convierte strings de query en números", () => {
    expect(
      agendaReviewQuerySchema.parse({ dailyCapacity: "4", horizonDays: "14" }),
    ).toEqual({ dailyCapacity: 4, horizonDays: 14 });
  });

  it("rechaza valores fuera de rango", () => {
    expect(
      agendaReviewQuerySchema.safeParse({ dailyCapacity: 0 }).success,
    ).toBe(false);
    expect(
      agendaReviewQuerySchema.safeParse({ horizonDays: 999 }).success,
    ).toBe(false);
  });
});

describe("agendaReviewSchema", () => {
  const review = {
    findings: [
      {
        kind: "OVERLAP" as const,
        severity: 0,
        taskIds: ["a", "b"],
        message: "Se pisan del 2026-10-06 al 2026-10-06",
      },
    ],
    overloadedDays: [{ date: "2026-10-06", count: 7 }],
    generatedAt: "2026-10-05T15:00:00.000Z",
    analyzedTasks: 12,
  };

  it("acepta una revisión con hallazgos", () => {
    expect(agendaReviewSchema.parse(review)).toEqual(review);
  });

  it("acepta una revisión vacía: ese es un resultado válido", () => {
    // La ausencia de hallazgos es lo que la tarjeta muestra como "todo bien".
    // Si el schema la rechazara, el endpoint no podría responder por ella.
    expect(
      agendaReviewSchema.parse({
        findings: [],
        overloadedDays: [],
        generatedAt: "2026-10-05T15:00:00.000Z",
        analyzedTasks: 0,
      }).findings,
    ).toEqual([]);
  });

  it("rechaza una severidad negativa y un kind desconocido", () => {
    expect(
      agendaFindingSchema.safeParse({
        kind: "OVERLAP",
        severity: -1,
        taskIds: ["a"],
        message: "x",
      }).success,
    ).toBe(false);
    expect(
      agendaFindingSchema.safeParse({
        kind: "LO_MAS_LIKE",
        severity: 1,
        taskIds: ["a"],
        message: "x",
      }).success,
    ).toBe(false);
  });

  it("exige analyzedTasks: sin él la UI no puede distinguir vacío de sin datos", () => {
    expect(
      agendaReviewSchema.safeParse({
        findings: [],
        overloadedDays: [],
        generatedAt: "2026-10-05T15:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
