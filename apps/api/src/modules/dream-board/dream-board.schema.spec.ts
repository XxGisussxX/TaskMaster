import { describe, expect, it } from "vitest";
import {
  createPinSchema,
  dreamPinColorSchema,
  dreamPinTypeSchema,
  pinIdParamsSchema,
  updateDreamPinSchema,
  updatePinSchema,
} from "@taskmaster/contracts";

describe("dreamPinTypeSchema", () => {
  it.each(["GOAL", "PROJECT", "LEARNING", "TRAVEL", "FINANCIAL", "HEALTH"])(
    "acepta el tipo %s",
    (type) => {
      expect(dreamPinTypeSchema.parse(type)).toBe(type);
    },
  );

  it("rechaza un tipo desconocido", () => {
    expect(dreamPinTypeSchema.safeParse("SALUD").success).toBe(false);
  });
});

describe("dreamPinColorSchema", () => {
  it("acepta los 6 colores de la paleta", () => {
    expect(
      dreamPinColorSchema.options.slice().sort((a, b) => a.localeCompare(b)),
    ).toEqual(["AMBER", "EMERALD", "ROSE", "SKY", "SLATE", "VIOLET"]);
  });

  it("rechaza un color fuera de la paleta", () => {
    expect(dreamPinColorSchema.safeParse("CHOCOLATE").success).toBe(false);
  });
});

describe("createPinSchema", () => {
  it("aplica defaults para tipo, color, posición y descripción", () => {
    expect(createPinSchema.parse({ title: "Correr 10k" })).toEqual({
      title: "Correr 10k",
      type: "GOAL",
      color: "AMBER",
      description: "",
      x: 0,
      y: 0,
    });
  });

  it("hace trim del título", () => {
    expect(createPinSchema.parse({ title: "  Viaje a Kyoto  " }).title).toBe(
      "Viaje a Kyoto",
    );
  });

  it("exige título", () => {
    expect(createPinSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createPinSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza títulos excesivamente largos", () => {
    expect(createPinSchema.safeParse({ title: "a".repeat(121) }).success).toBe(
      false,
    );
  });

  it("acepta posiciones negativas o decimales", () => {
    const pin = createPinSchema.parse({ title: "Meta", x: -12.5, y: 320.75 });
    expect(pin).toMatchObject({ x: -12.5, y: 320.75 });
  });

  it("rechaza posiciones no numéricas o infinitas", () => {
    expect(createPinSchema.safeParse({ title: "Meta", x: "10" }).success).toBe(
      false,
    );
    expect(
      createPinSchema.safeParse({ title: "Meta", y: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });

  it("acota las coordenadas a los límites del corcho (D6)", () => {
    expect(
      createPinSchema.safeParse({ title: "Meta", x: 10_001 }).success,
    ).toBe(false);
    expect(
      createPinSchema.safeParse({ title: "Meta", y: -10_001 }).success,
    ).toBe(false);
    expect(
      createPinSchema.safeParse({ title: "Meta", x: 10_000, y: -10_000 })
        .success,
    ).toBe(true);
  });

  it("acepta descripción opcional y acota su largo", () => {
    expect(
      createPinSchema.parse({ title: "Meta", description: "  con detalle " })
        .description,
    ).toBe("con detalle");
    expect(
      createPinSchema.safeParse({
        title: "Meta",
        description: "a".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("updatePinSchema", () => {
  it("acepta actualizar solo la posición (drag & drop)", () => {
    expect(updatePinSchema.parse({ x: 120, y: 48 })).toEqual({ x: 120, y: 48 });
  });

  it("acepta un subconjunto de campos", () => {
    expect(updatePinSchema.parse({ title: "Nuevo", color: "SKY" })).toEqual({
      title: "Nuevo",
      color: "SKY",
    });
  });

  it("rechaza un body vacío", () => {
    expect(updatePinSchema.safeParse({}).success).toBe(false);
  });

  it("no deja vaciar el título", () => {
    expect(updatePinSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("valida los enums también en la actualización", () => {
    expect(updatePinSchema.safeParse({ type: "NOPE" }).success).toBe(false);
    expect(updatePinSchema.safeParse({ color: "NOPE" }).success).toBe(false);
  });
});

describe("updateDreamPinSchema", () => {
  it("acepta actualizar solo la posición (drag & drop)", () => {
    expect(
      updateDreamPinSchema.parse({ positionX: 120, positionY: 48 }),
    ).toEqual({ positionX: 120, positionY: 48 });
  });

  it("acepta un subconjunto de campos", () => {
    expect(
      updateDreamPinSchema.parse({ title: "Nuevo", color: "SKY" }),
    ).toEqual({ title: "Nuevo", color: "SKY" });
  });

  it("rechaza un body vacío (PATCH {} → 400)", () => {
    const result = updateDreamPinSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("acepta `null` para borrar campos opcionales a propósito", () => {
    expect(
      updateDreamPinSchema.parse({
        imageUrl: null,
        sticker: null,
        linkedTaskId: null,
      }),
    ).toEqual({ imageUrl: null, sticker: null, linkedTaskId: null });
  });

  it("acepta cadena vacía para limpiar imagen y sticker (compat UI)", () => {
    expect(updateDreamPinSchema.parse({ imageUrl: "", sticker: "" })).toEqual({
      imageUrl: "",
      sticker: "",
    });
  });

  it("no deja vaciar el título", () => {
    expect(updateDreamPinSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rechaza una URL inválida en imageUrl", () => {
    expect(
      updateDreamPinSchema.safeParse({ imageUrl: "no-es-url" }).success,
    ).toBe(false);
  });

  it("rechaza un sticker demasiado largo", () => {
    expect(
      updateDreamPinSchema.safeParse({ sticker: "🚀".repeat(6) }).success,
    ).toBe(false);
  });

  it("valida los enums también en la actualización", () => {
    expect(updateDreamPinSchema.safeParse({ type: "NOPE" }).success).toBe(
      false,
    );
    expect(updateDreamPinSchema.safeParse({ color: "NOPE" }).success).toBe(
      false,
    );
  });

  it("acota las coordenadas a los límites del corcho (D6)", () => {
    expect(updateDreamPinSchema.safeParse({ positionX: 10_001 }).success).toBe(
      false,
    );
    expect(updateDreamPinSchema.safeParse({ positionY: -10_001 }).success).toBe(
      false,
    );
    expect(updateDreamPinSchema.safeParse({ positionX: 10_000 }).success).toBe(
      true,
    );
  });

  it("acepta ids de tarea no-cuid (seed) al re-vincular (D5)", () => {
    expect(
      updateDreamPinSchema.safeParse({ linkedTaskId: "seed_task_1" }).success,
    ).toBe(true);
    expect(
      updateDreamPinSchema.safeParse({
        linkedTaskId: "cmuxkg9tg0003v430hgpac5f4",
      }).success,
    ).toBe(true);
    expect(updateDreamPinSchema.safeParse({ linkedTaskId: "" }).success).toBe(
      false,
    );
  });
});

describe("pinIdParamsSchema", () => {
  it("acepta un id no vacío", () => {
    expect(pinIdParamsSchema.parse({ id: "pin1" })).toEqual({
      id: "pin1",
    });
  });

  it("rechaza un id vacío", () => {
    expect(pinIdParamsSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("usa la llave `id` que espera ParseIdPipe", () => {
    const result = pinIdParamsSchema.safeParse({
      id: "cmuxkg9tg0003v430hgpac5f4",
    });
    expect(result.success).toBe(true);
  });
});
