import { describe, it, expect } from "vitest";
import { classifyLine, parseMarkdown } from "./parser";

describe("parseMarkdown", () => {
  it("returns an empty array for empty content", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
  });

  it("detects fully uppercase lines as headings", () => {
    expect(parseMarkdown("INFORME MENSUAL")).toEqual([
      { type: "heading", content: "INFORME MENSUAL" },
    ]);
  });

  it("does not treat mixed case lines as headings", () => {
    expect(parseMarkdown("Informe Mensual")).toEqual([
      { type: "paragraph", content: "Informe Mensual" },
    ]);
  });

  it("does not treat lines without cased letters as headings", () => {
    expect(parseMarkdown("2024 -")).toEqual([
      { type: "paragraph", content: "2024 -" },
    ]);
  });

  it("detects '- ' lines as list items without the marker", () => {
    expect(parseMarkdown("- Primer punto")).toEqual([
      { type: "list-item", content: "Primer punto" },
    ]);
  });

  it("detects numbered lines and keeps the marker in the content", () => {
    expect(parseMarkdown("1. Primer paso")).toEqual([
      { type: "numbered-item", content: "1. Primer paso" },
    ]);
    expect(parseMarkdown("2. Segundo paso")).toEqual([
      { type: "numbered-item", content: "2. Segundo paso" },
    ]);
  });

  it("checks numbered items before headings", () => {
    expect(parseMarkdown("1. RESUMEN EJECUTIVO")).toEqual([
      { type: "numbered-item", content: "1. RESUMEN EJECUTIVO" },
    ]);
  });

  it("treats everything else as paragraph", () => {
    expect(parseMarkdown("Texto normal con acentos: ñáéíóú.")).toEqual([
      { type: "paragraph", content: "Texto normal con acentos: ñáéíóú." },
    ]);
  });

  it("uses blank lines as section separators and joins paragraph lines", () => {
    const sections = parseMarkdown(
      ["TITULO", "", "Linea uno", "Linea dos", "", "- Item"].join("\n"),
    );

    expect(sections).toEqual([
      { type: "heading", content: "TITULO" },
      { type: "paragraph", content: "Linea uno\nLinea dos" },
      { type: "list-item", content: "Item" },
    ]);
  });

  it("keeps consecutive list items as separate sections", () => {
    const sections = parseMarkdown(["- Uno", "- Dos", "- Tres"].join("\n"));

    expect(sections).toEqual([
      { type: "list-item", content: "Uno" },
      { type: "list-item", content: "Dos" },
      { type: "list-item", content: "Tres" },
    ]);
  });

  it("handles windows and unix line endings", () => {
    expect(parseMarkdown("UN TITULO\r\n\r\n- Uno").length).toBe(2);
    expect(parseMarkdown("UN TITULO\n\n- Uno").length).toBe(2);
  });

  it("parses a full document keeping the section order", () => {
    const sections = parseMarkdown(
      [
        "REPORTE DE VENTAS",
        "",
        "Resumen del trimestre con los numeros mas relevantes.",
        "",
        "1. Introduccion",
        "2. Metodologia",
        "",
        "- Metricas usadas",
        "- Fuentes consultadas",
      ].join("\n"),
    );

    expect(sections.map((section) => section.type)).toEqual([
      "heading",
      "paragraph",
      "numbered-item",
      "numbered-item",
      "list-item",
      "list-item",
    ]);
  });
});

describe("parseMarkdown con subheadings", () => {
  it("detecta titulos en Title Case como heading-2", () => {
    expect(parseMarkdown("Resumen Ejecutivo", { subheadings: true })).toEqual([
      { type: "heading-2", content: "Resumen Ejecutivo" },
    ]);
  });

  it("no detecta heading-2 por defecto", () => {
    expect(parseMarkdown("Resumen Ejecutivo")).toEqual([
      { type: "paragraph", content: "Resumen Ejecutivo" },
    ]);
  });

  it("ignora palabras menores al evaluar el titulo", () => {
    expect(
      parseMarkdown("Analisis de los Resultados", { subheadings: true }),
    ).toEqual([{ type: "heading-2", content: "Analisis de los Resultados" }]);
  });

  it("no confunde parrafos largos con subtitulos", () => {
    const sentence =
      "Este es un parrafo normal que empieza en minuscula y sigue largo.";

    expect(parseMarkdown(sentence, { subheadings: true })).toEqual([
      { type: "paragraph", content: sentence },
    ]);
  });

  it("no toma como subtitulo una linea que termina en puntuacion", () => {
    expect(parseMarkdown("Resumen Ejecutivo.", { subheadings: true })).toEqual([
      { type: "paragraph", content: "Resumen Ejecutivo." },
    ]);
  });

  it("mantiene la prioridad de las listas sobre los subtitulos", () => {
    const sections = parseMarkdown(
      ["Resumen Ejecutivo", "- Punto"].join("\n"),
      {
        subheadings: true,
      },
    );

    expect(sections.map((section) => section.type)).toEqual([
      "heading-2",
      "list-item",
    ]);
  });
});

describe("classifyLine", () => {
  it.each([
    ["REPORTE ANUAL", "heading"],
    ["- Un punto", "list-item"],
    ["* Otro punto", "list-item"],
    ["\u2022 Viñeta", "list-item"],
    ["1. Primer paso", "numbered-item"],
    ["12. Doce", "numbered-item"],
    ["Un parrafo comun", "paragraph"],
    ["", "paragraph"],
  ])("clasifica %s como %s", (line, expected) => {
    expect(classifyLine(line)).toBe(expected);
  });

  it("no devuelve heading-2 porque la deteccion es opt-in", () => {
    expect(classifyLine("Resumen Ejecutivo")).toBe("paragraph");
  });
});
