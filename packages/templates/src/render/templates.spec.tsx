import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { embeddedFontNames, pdfText } from "../test/pdf-text";
import type { DocumentTemplateProps } from "../types";
import type { PdfTemplate, TemplateId } from "./config";
import { createDocumentTheme } from "../theme/tokens";
import { createTemplateStyles } from "./styles";
import {
  CARTA_TEMPLATE,
  EDITORIAL_TEMPLATE,
  INFORME_TEMPLATE,
  MINIMAL_TEMPLATE,
  TEMPLATE_BY_ID,
} from "./config";
import { DOCUMENT_TEMPLATES, TEMPLATE_COMPONENTS } from "../templates/registry";

const GENERATED_AT = new Date(2026, 9, 5);

function fixture(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../__fixtures__/${relative}`, import.meta.url)),
    "utf8",
  );
}

async function render(
  id: TemplateId,
  props: Partial<DocumentTemplateProps>,
): Promise<{ text: string; flat: string; fonts: string[]; raw: string }> {
  const full: DocumentTemplateProps = {
    content: "Documento",
    generatedAt: GENERATED_AT,
    ...props,
  };
  const Component = TEMPLATE_COMPONENTS[id];
  const buffer = await renderToBuffer(
    Component(full) as ReactElement<DocumentProps>,
  );
  const text = pdfText(buffer);
  return {
    text,
    flat: text.replace(/\s/g, ""),
    fonts: embeddedFontNames(buffer),
    raw: buffer.toString("latin1"),
  };
}

const MATRIX_FIXTURES = [
  "markdown/informe-ventas.md",
  "plain/carta.md",
  "markdown/proyecto.md",
  "markdown/edge-nested-table.md",
] as const;

const FONT_SIZES = ["sm", "md", "lg"] as const;
const MARGINS = ["narrow", "normal", "wide"] as const;

describe("matriz plantilla × fixture × fontSize × margin", () => {
  for (const entry of DOCUMENT_TEMPLATES) {
    it(`${entry.id}: 4 fixtures × 3 tamaños × 3 márgenes`, async () => {
      for (const fixturePath of MATRIX_FIXTURES) {
        const content = fixture(fixturePath);
        for (const fontSize of FONT_SIZES) {
          for (const margin of MARGINS) {
            const { flat } = await render(entry.id, {
              content,
              fontSize,
              margin,
            });
            expect(flat.length).toBeGreaterThan(0);
          }
        }
      }
    }, 120_000);
  }
});

describe("ninguna plantilla pierde bloques del DocumentModel", () => {
  const cases: { fixturePath: string; tokens: string[] }[] = [
    {
      fixturePath: "markdown/informe-ventas.md",
      tokens: ["Online", "412.400", "Partners"],
    },
    { fixturePath: "plain/carta.md", tokens: ["Maria", "250.00"] },
    {
      fixturePath: "markdown/proyecto.md",
      tokens: ["JWT", "React19", "Codefreeze"],
    },
  ];

  for (const entry of DOCUMENT_TEMPLATES) {
    it(`${entry.id} conserva tablas, listas y código`, async () => {
      for (const testCase of cases) {
        const { flat } = await render(entry.id, {
          content: fixture(testCase.fixturePath),
        });
        for (const token of testCase.tokens) {
          expect(flat).toContain(token);
        }
      }
    }, 60_000);
  }
});

describe("Carta", () => {
  it("no pinta cabecera ni pie decorativos", async () => {
    const { text } = await render("carta", {
      content: fixture("plain/carta.md"),
    });
    expect(text).not.toContain("P\u00e1gina");
  });

  it("compone el bloque remitente/destinatario/asunto desde el front-matter", async () => {
    const content = [
      "---",
      "from: Juan P\u00e9rez",
      "to: Mar\u00eda L\u00f3pez",
      "subject: Cuota del club de lectura",
      "date: 5 de octubre de 2026",
      "---",
      "# Confirmaci\u00f3n de pago",
      "",
      "Cuerpo de la carta.",
    ].join("\n");
    const { flat } = await render("carta", { content });
    expect(flat).toContain("JuanPérez");
    expect(flat).toContain("MaríaLópez");
    expect(flat).toContain("Cuotadelclubdelectura");
    expect(flat).toContain("5deoctubrede2026");
  });
});

describe("Informe", () => {
  it("genera portada y un índice con enlaces internos a H1/H2", async () => {
    const { text, raw } = await render("informe", {
      content: fixture("markdown/informe-ventas.md"),
    });
    expect(text).toContain("\u00cdndice");
    expect(text).toContain("Resumen ejecutivo");
    expect(text).toContain("Acciones propuestas");
    expect(raw).toContain("/Dest");
  });

  it("numera las secciones en el cuerpo", async () => {
    const { flat } = await render("informe", {
      content: "# Uno\n\n## Uno A\n\nCuerpo.",
    });
    expect(flat).toContain("1Uno");
    expect(flat).toContain("1.1UnoA");
  });
});

describe("Editorial", () => {
  it("usa serif en el cuerpo", async () => {
    const { fonts } = await render("editorial", {
      content: "Cuerpo con texto.",
    });
    expect(fonts.some((name) => name.includes("SourceSerif"))).toBe(true);
  });
});

describe("diferenciación entre plantillas", () => {
  const themeFor = (template: PdfTemplate) =>
    createDocumentTheme({
      bodyFont: template.theme.bodyFont,
      headingFont: template.theme.headingFont,
      density: template.theme.density,
      headingScale: template.theme.headingScale,
    });

  it("dos plantillas difieren en fuente, tamaño de título, espaciado y composición", () => {
    const minimal = createTemplateStyles(
      themeFor(MINIMAL_TEMPLATE),
      MINIMAL_TEMPLATE.layout,
    );
    const editorial = createTemplateStyles(
      themeFor(EDITORIAL_TEMPLATE),
      EDITORIAL_TEMPLATE.layout,
    );

    expect(minimal.paragraph.fontFamily).not.toEqual(
      editorial.paragraph.fontFamily,
    );
    expect(minimal.paragraph.fontFamily?.[0]).toBe("TaskSans");
    expect(editorial.paragraph.fontFamily?.[0]).toBe("TaskSerif");
    expect(editorial.h1.fontSize).toBeGreaterThan(
      minimal.h1.fontSize as number,
    );
    expect(editorial.paragraph.marginBottom).not.toBe(
      minimal.paragraph.marginBottom,
    );
    expect(EDITORIAL_TEMPLATE.layout.dropCap).toBe(true);
    expect(MINIMAL_TEMPLATE.layout.dropCap).toBe(false);
    expect(INFORME_TEMPLATE.layout.cover).toBe(true);
    expect(MINIMAL_TEMPLATE.layout.cover).toBe(false);
  });

  it("renderiza serif frente a sans para el mismo contenido", async () => {
    const content = "Contenido idéntico.";
    const minimal = await render("minimal", { content });
    const editorial = await render("editorial", { content });
    expect(minimal.fonts.some((name) => name.includes("Inter"))).toBe(true);
    expect(editorial.fonts.some((name) => name.includes("SourceSerif"))).toBe(
      true,
    );
  });
});

describe("multi-render consecutivo conserva el texto extraído", () => {
  const content = [
    "# A\u00f1o de la \u00f1and\u00fa",
    "",
    "El ni\u00f1o comi\u00f3 pi\u00f1a y caf\u00e9. \u00bfQu\u00e9 pas\u00f3? \u00a1\u00d3rale!",
  ].join("\n");
  const expected = ["niño", "piña", "café", "¿Qué", "¡Órale"];

  for (const id of ["editorial", "informe", "carta"] as const) {
    it(`${id}: 2.º y 3.º documento con glifos correctos`, async () => {
      const texts: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const { flat } = await render(id, { content });
        texts.push(flat);
      }
      for (let i = 1; i < texts.length; i += 1) {
        for (const token of expected) {
          expect(texts[i]).toContain(token);
        }
      }
    }, 60_000);
  }
});

describe("registro de plantillas", () => {
  it("expone las cinco plantillas con su componente y acento", () => {
    const ids = DOCUMENT_TEMPLATES.map((entry) => entry.id);
    expect(ids).toEqual([
      "minimal",
      "corporate",
      "editorial",
      "carta",
      "informe",
    ]);
    for (const entry of DOCUMENT_TEMPLATES) {
      const template: PdfTemplate = TEMPLATE_BY_ID[entry.id];
      expect(entry.template).toBe(template);
      expect(entry.component).toBe(TEMPLATE_COMPONENTS[entry.id]);
    }
    expect(CARTA_TEMPLATE.theme.usesAccent).toBe(false);
    expect(MINIMAL_TEMPLATE.theme.usesAccent).toBe(true);
  });
});
