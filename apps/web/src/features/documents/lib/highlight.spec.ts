import { describe, it, expect } from "vitest";
import { lineNumbers, PLACEHOLDER, styleForLine } from "./highlight";

describe("styleForLine", () => {
  it("resalta los titulos en mayusculas", () => {
    expect(styleForLine("heading", "REPORTE ANUAL")).toContain(
      "text-foreground",
    );
  });

  it("resalta los subtitulos con peso semibold", () => {
    expect(styleForLine("heading-2", "Resumen Ejecutivo")).toContain(
      "font-semibold",
    );
  });

  it("resalta listas y numeradas con el color primario", () => {
    expect(styleForLine("list-item", "- Punto")).toContain("text-primary");
    expect(styleForLine("numbered-item", "1. Punto")).toContain("text-primary");
  });

  it("deja los parrafos en tono secundario", () => {
    expect(styleForLine("paragraph", "Texto")).toContain(
      "text-muted-foreground",
    );
  });

  it("no aplica estilo a las lineas vacias", () => {
    expect(styleForLine("paragraph", "")).toBe("");
  });
});

describe("lineNumbers", () => {
  it("devuelve una linea por cada linea del documento", () => {
    expect(lineNumbers(3)).toEqual([1, 2, 3]);
  });

  it("siempre devuelve al menos una linea", () => {
    expect(lineNumbers(0)).toEqual([1]);
  });
});

describe("placeholder", () => {
  it("explica la convencion de Markdown usada por el parser", () => {
    expect(PLACEHOLDER).toContain("MAYÚSCULAS");
    expect(PLACEHOLDER).toContain("-");
    expect(PLACEHOLDER).toContain("1.");
  });
});
