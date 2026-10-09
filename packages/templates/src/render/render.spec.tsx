import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { pdfText } from "../test/pdf-text";
import { breakLongWords, prepareCode } from "./text";
import { isNumericColumn } from "./blocks";
import { renderTemplate } from "./renderTemplate";
import { CORPORATE_TEMPLATE } from "./config";
import type { DocumentTemplateProps } from "../types";

const GENERATED_AT = new Date(2026, 0, 15);

function renderPdf(
  props: Partial<DocumentTemplateProps> = {},
): Promise<string> {
  const full: DocumentTemplateProps = {
    content: "Documento",
    generatedAt: GENERATED_AT,
    ...props,
  };
  return renderToBuffer(renderTemplate(full, CORPORATE_TEMPLATE)).then(pdfText);
}

describe("breakLongWords", () => {
  it("devuelve tokens cortos tal cual", () => {
    expect(breakLongWords("palabra")).toEqual(["palabra"]);
    expect(breakLongWords("x".repeat(24))).toEqual(["x".repeat(24)]);
  });

  it("parte tokens largos en trozos de 24 caracteres", () => {
    const token = "a".repeat(53);
    const parts = breakLongWords(token);
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.length)).toEqual([24, 24, 5]);
    expect(parts.join("")).toBe(token);
  });
});

describe("prepareCode", () => {
  it("expande tabuladores a 4 espacios", () => {
    expect(prepareCode("\tfoo")).toBe("\u00a0\u00a0\u00a0\u00a0foo");
    expect(prepareCode("a\tb")).toBe("a    b");
  });

  it("convierte espacios iniciales en NBSP (U+00A0)", () => {
    expect(prepareCode("    foo")).toBe("\u00a0\u00a0\u00a0\u00a0foo");
    expect(prepareCode("  foo\n    bar")).toBe(
      "\u00a0\u00a0foo\n\u00a0\u00a0\u00a0\u00a0bar",
    );
  });

  it("conserva espacios intermedios y normaliza CRLF", () => {
    expect(prepareCode("a  b\r\nc")).toBe("a  b\nc");
    expect(prepareCode("sin")).toBe("sin");
  });
});

describe("isNumericColumn", () => {
  const cell = (value: string) => ({
    inlines: [{ type: "text" as const, value }],
  });
  const rows = (columnValues: string[][]) =>
    columnValues.map((cells) => ({ cells: cells.map(cell) }));

  it("detecta columnas numericas y monetarias", () => {
    expect(isNumericColumn(rows([["1.234"], ["-45"], ["67,8%"]]), 0)).toBe(
      true,
    );
    expect(isNumericColumn(rows([["€1.000"], ["$20"]]), 0)).toBe(true);
  });

  it("rechaza columnas mixtas o vacias", () => {
    expect(isNumericColumn(rows([["12"], ["Ventas"]]), 0)).toBe(false);
    expect(isNumericColumn(rows([[""], ["  "]]), 0)).toBe(false);
  });
});

describe("render del motor", () => {
  it("indenta el codigo con NBSP visibles en el PDF", async () => {
    const text = await renderPdf({
      content: ["```", "\tdef foo():", "    return 1", "```"].join("\n"),
    });
    const flat = text.replace(/\n/g, "");
    expect(flat).toContain("\u00a0\u00a0\u00a0\u00a0def foo():");
    expect(flat).toContain("\u00a0\u00a0\u00a0\u00a0return 1");
  });

  it("parte tokens largos sin perder caracteres", async () => {
    const token = "supercalifragilisticexpialidocious".repeat(3);
    const text = await renderPdf({ content: `Token: ${token}` });
    const compact = text.replace(/[\s-]/g, "");
    expect(compact).toContain(token);
  });

  it("renderiza checkboxes GFM", async () => {
    const text = await renderPdf({
      content: ["- [ ] Pendiente", "- [x] Hecho"].join("\n"),
    });
    expect(text).toContain("\u2610");
    expect(text).toContain("\u2611");
    expect(text).toContain("Pendiente");
    expect(text).toContain("Hecho");
  });

  it("renderiza viñetas anidadas con glifos por profundidad", async () => {
    const text = await renderPdf({
      content: ["- Nivel uno", "  - Nivel dos", "    - Nivel tres"].join("\n"),
    });
    expect(text).toContain("\u2022");
    expect(text).toContain("\u25e6");
    expect(text).toContain("\u25aa");
  });

  it("genera anotaciones /URI para los enlaces", async () => {
    const buffer = await renderToBuffer(
      renderTemplate(
        {
          content: "Consulta la [documentacion](https://example.com/docs).",
          generatedAt: GENERATED_AT,
        },
        CORPORATE_TEMPLATE,
      ),
    );
    const raw = buffer.toString("latin1");
    expect(raw).toContain("/URI");
    expect(raw).toContain("https://example.com/docs");
  });

  it("omite emojis sin glifo del PDF", async () => {
    const text = await renderPdf({
      content: "Lanzamiento \u{1F680} completado con exito.",
    });
    expect(text).toContain("Lanzamiento");
    expect(text).toContain("completado con exito.");
    expect(text).not.toContain("\u{1F680}");
  });

  it("cuenta el titulo del contenido una sola vez (sin duplicar cabecera)", async () => {
    const text = await renderPdf({ content: "INFORME ANUAL\n\nCuerpo." });
    expect(text.match(/INFORME ANUAL/g)).toHaveLength(1);
  });

  it("muestra el titulo explicito en cabecera y el H1 del contenido", async () => {
    const text = await renderPdf({
      content: "REPORTE DE VENTAS\n\nCuerpo.",
      title: "Titulo Del Documento",
    });
    expect(text.toUpperCase()).toContain("TITULO DEL DOCUMENTO");
    expect(text).toContain("REPORTE DE VENTAS");
    expect(text.match(/REPORTE DE VENTAS/g)).toHaveLength(1);
  });

  it("repite la cabecera en todas las paginas", async () => {
    const long = Array.from(
      { length: 220 },
      (_, index) => `Linea ${index}`,
    ).join("\n");
    const text = await renderPdf({
      content: long,
      title: "Titulo Del Documento",
    });
    const totalPages = Number(/P\u00e1gina 1 de (\d+)/.exec(text)?.[1] ?? "0");
    expect(totalPages).toBeGreaterThan(1);
    expect(text.toUpperCase().match(/TITULO DEL DOCUMENTO/g)).toHaveLength(
      totalPages,
    );
  });

  it("no desborda PDFKit con muchas secciones y pie fijo en bottom", async () => {
    const sections = Array.from({ length: 40 }, (_, index) =>
      [
        `Titulo ${index + 1}`,
        "Parrafo de relleno de la seccion con varias palabras para forzar el paginado entre secciones.",
      ].join("\n\n\n"),
    );
    const text = await renderPdf({ content: sections.join("\n\n") });
    const totalPages = Number(/P\u00e1gina 1 de (\d+)/.exec(text)?.[1] ?? "0");
    expect(totalPages).toBeGreaterThan(1);
    expect(text).toContain("P\u00e1gina 2 de");
  });
});
