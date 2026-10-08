import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { pdfText } from "../test/pdf-text";
import { MinimalTemplate } from "./MinimalTemplate";
import { CorporateTemplate } from "./CorporateTemplate";
import { MINIMAL_TEMPLATE, CORPORATE_TEMPLATE } from "../render/config";
import type { PdfTemplate } from "../render/config";
import { createDocumentTheme } from "../theme/tokens";
import { createTemplateStyles } from "../render/styles";
import { FONT_SIZE_SCALES } from "../theme";
import type { TemplateStyles } from "../render/styles";
import type { DocumentTemplateProps } from "../types";

const GENERATED_AT = new Date(2026, 0, 15);
const PARAGRAPH = "Resumen del trimestre con los numeros mas relevantes.";

const CONTENT = [
  "# REPORTE DE VENTAS",
  "",
  "## Resumen Ejecutivo",
  "",
  PARAGRAPH,
  "",
  "1. Introduccion",
  "2. Metodologia",
  "",
  "- Metricas usadas",
  "- Fuentes consultadas",
].join("\n");

const PROPS: DocumentTemplateProps = {
  content: CONTENT,
  generatedAt: GENERATED_AT,
};

function themeOptions(template: PdfTemplate) {
  return {
    accentColor: template.theme.accent,
    bodyFont: template.theme.bodyFont,
    headingFont: template.theme.headingFont,
    density: template.theme.density,
    headingScale: template.theme.headingScale,
  };
}

function themeFor(template: PdfTemplate) {
  return createDocumentTheme(themeOptions(template));
}

function stylesFor(template: PdfTemplate): TemplateStyles {
  return createTemplateStyles(themeFor(template), template.layout);
}

describe.each([
  ["MinimalTemplate", MinimalTemplate, MINIMAL_TEMPLATE],
  ["CorporateTemplate", CorporateTemplate, CORPORATE_TEMPLATE],
] as const)("%s", (_name, templateComponent, definition) => {
  function renderPdf(props: Partial<DocumentTemplateProps> = {}) {
    const full = { ...PROPS, ...props };
    return renderToBuffer(templateComponent(full)).then(pdfText);
  }

  describe("contenido del PDF", () => {
    it("incluye toda la jerarquia del documento", async () => {
      const text = await renderPdf();

      expect(text).toContain("REPORTE DE VENTAS");
      expect(text).toContain("Resumen Ejecutivo");
      expect(text).toContain(PARAGRAPH);
      expect(text).toContain("Introduccion");
      expect(text).toContain("Metodologia");
      expect(text).toContain("Metricas usadas");
      expect(text).toContain("Fuentes consultadas");
    });

    it("numera las listas y sangra los items", async () => {
      const text = await renderPdf();

      expect(text).toMatch(/1\.\s+Introduccion/);
      expect(text).toMatch(/2\.\s+Metodologia/);
    });

    it("incluye footer con numeracion de pagina y fecha", async () => {
      const text = await renderPdf();
      expect(text).toContain("P\u00e1gina 1 de 1");
      expect(text).toContain("15/01/2026");
    });

    it("usa el titulo explicito cuando se pasa por prop", async () => {
      const text = await renderPdf({ title: "Titulo Del Documento" });
      expect(text.toUpperCase()).toContain("TITULO DEL DOCUMENTO");
    });

    it("usa el primer titulo del contenido como titulo del documento", async () => {
      const text = await renderPdf();
      expect(text.match(/REPORTE DE VENTAS/g)?.length).toBe(1);
    });

    it("genera un PDF valido", async () => {
      const buffer = await renderToBuffer(templateComponent(PROPS));
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("no rompe con contenido minimo", async () => {
      const buffer = await renderToBuffer(
        templateComponent({ content: "Texto simple." }),
      );
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("pagina los documentos largos", async () => {
      const long = Array.from(
        { length: 150 },
        (_, index) => `Linea ${index}`,
      ).join("\n");
      const text = await renderPdf({ content: long, fontSize: "lg" });

      expect(text).toContain("Linea 149");
      expect(text).toContain("P\u00e1gina 2 de");
    });
  });

  describe("estilos derivados de la plantilla", () => {
    const styles = stylesFor(definition);

    it("h1 con negrita, regla inferior y alineacion segun layout", () => {
      expect(styles.h1).toMatchObject({ fontWeight: "bold" });
      expect(styles.h1).toMatchObject({ borderBottomWidth: 1 });
      expect(styles.h1).toMatchObject({
        textAlign: definition.layout.h1Align,
      });
      expect(styles.h1).toMatchObject({
        color:
          definition.layout.h1Accent === true
            ? definition.theme.accent
            : "#1a1a1a",
      });
    });

    it("h2 con color segun plantilla y margenes", () => {
      expect(styles.h2).toMatchObject({ fontWeight: "bold" });
      expect(styles.h2).toMatchObject({
        color:
          definition.layout.h2Accent === true
            ? definition.theme.accent
            : "#1a1a1a",
      });
    });

    it("parrafos con cuerpo del tema e interlineado", () => {
      expect(styles.paragraph).toMatchObject({
        fontSize: 10.5,
        lineHeight: 1.55,
      });
      expect(styles.paragraph).toMatchObject({
        textAlign: definition.layout.paragraphAlign,
      });
    });

    it("listas y vinetas con acento cuando la plantilla lo usa", () => {
      expect(styles.list).toMatchObject({
        marginLeft: expect.any(Number),
        marginBottom: expect.any(Number),
      });
      expect(styles.marker).toMatchObject({
        fontFamily: expect.any(Array),
        fontSize: 10.5,
      });
      expect(styles.markerAccent).toMatchObject({
        color: definition.theme.accent,
      });
      expect(styles.markerNumber).toMatchObject({
        fontWeight: "bold",
        textAlign: "right",
      });
    });

    it("separador gris claro y cabecera con logo por variante", () => {
      expect(styles.separator).toMatchObject({
        height: 1,
        backgroundColor: "#e5e7eb",
      });
      expect(styles.header).toMatchObject({ flexDirection: "row" });
      expect(styles.header).toMatchObject({
        borderBottomWidth: definition.layout.header === "brand" ? 2 : 1,
      });
      expect(styles.logo).toMatchObject({
        width: definition.layout.header === "brand" ? 28 : 26,
      });
    });

    it("footer fijo con borde superior", () => {
      expect(styles.footer).toMatchObject({
        position: "absolute",
        borderTopWidth: 1,
      });
      expect(styles.footerText).toMatchObject({ fontSize: 9 });
    });
  });

  describe("opciones de tema", () => {
    it("escala todos los cuerpos con el tamano de fuente", () => {
      const rounded = (value: number) => Math.round(value * 100) / 100;
      expect(
        createTemplateStyles(
          createDocumentTheme({ fontSize: "sm", ...themeOptions(definition) }),
          definition.layout,
        ).paragraph.fontSize,
      ).toBe(rounded(10.5 * FONT_SIZE_SCALES.sm));
      expect(
        createTemplateStyles(
          createDocumentTheme({ fontSize: "lg", ...themeOptions(definition) }),
          definition.layout,
        ).paragraph.fontSize,
      ).toBe(rounded(10.5 * FONT_SIZE_SCALES.lg));
    });

    it("cambia el margen de la pagina", () => {
      const paddingFor = (margin: "narrow" | "normal" | "wide") =>
        createTemplateStyles(createDocumentTheme({ margin }), definition.layout)
          .page.paddingHorizontal;
      expect(paddingFor("narrow")).toBe(80);
      expect(paddingFor("normal")).toBe(104);
      expect(paddingFor("wide")).toBe(128);
    });

    it("aplica el color de acento elegido", () => {
      const themed = createDocumentTheme({ accentColor: "#b91c1c" });
      const styles = createTemplateStyles(themed, definition.layout);
      expect(styles.logo).toMatchObject({ backgroundColor: "#b91c1c" });
      expect(styles.codeBlock).toMatchObject({ borderLeftColor: "#b91c1c" });
      if (definition.layout.h1Accent) {
        expect(styles.h1).toMatchObject({ color: "#b91c1c" });
      }
    });

    it("devuelve la misma instancia para el mismo tema y layout", () => {
      const a = createTemplateStyles(themeFor(definition), definition.layout);
      const b = createTemplateStyles(themeFor(definition), definition.layout);
      expect(a).toBe(b);
    });
  });
});
