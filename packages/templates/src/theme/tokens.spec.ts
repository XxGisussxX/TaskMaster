import { describe, it, expect } from "vitest";
import {
  BASE_SPACING,
  BASE_TYPE_SIZES,
  PAGE_MARGIN_PADDINGS,
  createDocumentTheme,
} from "./tokens";
import { DEFAULT_ACCENT_COLOR } from "../theme";

describe("createDocumentTheme", () => {
  it("aplica los valores por defecto", () => {
    const theme = createDocumentTheme();
    expect(theme.margin).toBe(104);
    expect(theme.colors.accent).toBe(DEFAULT_ACCENT_COLOR);
    expect(theme.colors.text).toBe("#1a1a1a");
    expect(theme.lineHeights).toEqual({
      body: 1.55,
      heading: 1.2,
      table: 1.4,
      code: 1.45,
    });
    expect(theme.sizes).toEqual({ ...BASE_TYPE_SIZES });
    expect(theme.spacing).toEqual({ ...BASE_SPACING });
  });

  it("escala tamaños y espaciado con la opción fontSize", () => {
    for (const fontSize of ["sm", "md", "lg"] as const) {
      const scale = { sm: 0.9, md: 1, lg: 1.15 }[fontSize];
      const theme = createDocumentTheme({ fontSize });
      for (const [key, base] of Object.entries(BASE_TYPE_SIZES)) {
        const expected = Math.round(base * scale * 100) / 100;
        expect(
          theme.sizes[key as keyof typeof theme.sizes],
          `${fontSize}.${key}`,
        ).toBe(expected);
      }
      for (const [key, base] of Object.entries(BASE_SPACING)) {
        const expected = Math.round(base * scale * 100) / 100;
        expect(
          theme.spacing[key as keyof typeof theme.spacing],
          `${fontSize}.${key}`,
        ).toBe(expected);
      }
    }
  });

  it("usa padding de página según la opción margin", () => {
    expect(createDocumentTheme({ margin: "narrow" }).margin).toBe(
      PAGE_MARGIN_PADDINGS.narrow,
    );
    expect(createDocumentTheme({ margin: "wide" }).margin).toBe(
      PAGE_MARGIN_PADDINGS.wide,
    );
    expect(PAGE_MARGIN_PADDINGS).toEqual({
      narrow: 80,
      normal: 104,
      wide: 128,
    });
  });

  it("acepta un color de acento propio", () => {
    expect(createDocumentTheme({ accentColor: "#ff0000" }).colors.accent).toBe(
      "#ff0000",
    );
  });

  it("expone las cadenas de familias en el orden esperado", () => {
    const { fonts } = createDocumentTheme();
    expect(fonts.body).toEqual(["TaskSerif", "TaskSans", "TaskMono"]);
    expect(fonts.heading).toEqual(["TaskSans", "TaskSerif", "TaskMono"]);
    expect(fonts.mono).toEqual(["TaskMono", "TaskSans", "TaskSerif"]);
    expect(new Set(fonts.body).size).toBe(3);
  });

  it("devuelve copias aisladas entre instancias", () => {
    const first = createDocumentTheme();
    first.fonts.body.push("Mutation");
    first.sizes.body = 99;
    const second = createDocumentTheme();
    expect(second.fonts.body).toHaveLength(3);
    expect(second.sizes.body).toBe(BASE_TYPE_SIZES.body);
  });

  it("mantiene el espaciado base en múltiplos de 4", () => {
    const { spacing } = createDocumentTheme();
    for (const value of Object.values(spacing)) {
      expect(value % 4).toBe(0);
    }
  });
});
