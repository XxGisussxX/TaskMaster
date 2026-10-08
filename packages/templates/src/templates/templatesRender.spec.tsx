import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  MinimalTemplate,
  resolveStyles as minimalStyles,
} from "./MinimalTemplate";
import {
  CorporateTemplate,
  resolveStyles as corporateStyles,
} from "./CorporateTemplate";
import type { DocumentTemplateProps } from "../types";

const GENERATED_AT = new Date(2026, 0, 15);
const PARAGRAPH = "Resumen del trimestre con los numeros mas relevantes.";

const CONTENT = [
  "REPORTE DE VENTAS",
  "",
  "Resumen Ejecutivo",
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

interface PdfStyles {
  h1: Record<string, unknown>;
  h2: Record<string, unknown>;
  paragraph: Record<string, unknown>;
  list: Record<string, unknown>;
  marker: Record<string, unknown>;
  number: Record<string, unknown>;
  block: Record<string, unknown>;
  separator: Record<string, unknown>;
  page: Record<string, unknown>;
  header: Record<string, unknown>;
  logo: Record<string, unknown>;
  footer: Record<string, unknown>;
  footerText: Record<string, unknown>;
}

function pdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  const pages: string[] = [];
  let stream: RegExpExecArray | null;

  while ((stream = streamPattern.exec(raw)) !== null) {
    let content = stream[1] ?? "";

    try {
      content = inflateSync(Buffer.from(content, "latin1")).toString("latin1");
    } catch {
      /* stream not deflated */
    }

    let text = "";
    for (const hex of content.match(/<([0-9a-fA-F]+)>/g) ?? []) {
      const digits = hex.slice(1, -1);
      for (let index = 0; index + 1 < digits.length; index += 2) {
        text += String.fromCharCode(
          Number.parseInt(digits.slice(index, index + 2), 16),
        );
      }
    }

    if (text.length > 0) {
      pages.push(text);
    }
  }

  return pages.join("\n");
}

function renderPdf(props: Partial<DocumentTemplateProps> = {}) {
  const full = { ...PROPS, ...props };

  return renderToBuffer((CorporateTemplate as any)(full)).then(pdfText);
}

describe.each([
  ["MinimalTemplate", MinimalTemplate, minimalStyles, "#111827"],
  ["CorporateTemplate", CorporateTemplate, corporateStyles, "#1e3a5f"],
] as unknown as [
  string,
  (props: any) => any,
  (props?: any) => PdfStyles,
  string,
][])("%s", (_name, template, resolveStyles, accent) => {
  describe("contenido del PDF", () => {
    it("incluye toda la jerarquia del documento", async () => {
      const text = await renderPdf({} as any);

      expect(text).toContain("REPORTE DE VENTAS");
      expect(text).toContain("Resumen Ejecutivo");
      expect(text).toContain(PARAGRAPH);
      expect(text).toContain("Introduccion");
      expect(text).toContain("Metodologia");
      expect(text).toContain("Metricas usadas");
      expect(text).toContain("Fuentes consultadas");
    });

    it("numera las listas y sangra los items", async () => {
      const text = await renderPdf({} as any);

      expect(text).toMatch(/1\.\s+Introduccion/);
      expect(text).toMatch(/2\.\s+Metodologia/);
    });

    it("incluye footer con numeracion de pagina y fecha", async () => {
      const text = await renderPdf({} as any);
      expect(text).toContain("P\u00e1gina 1 de 1");
      expect(text).toContain("15/01/2026");
    });

    it("usa el titulo explicito cuando se pasa por prop", async () => {
      const text = await renderPdf({ title: "Titulo Del Documento" } as any);
      expect(text.toUpperCase()).toContain("TITULO DEL DOCUMENTO");
    });

    it("usa el primer titulo del contenido como titulo del documento", async () => {
      const text = await renderPdf({} as any);
      expect(text.match(/REPORTE DE VENTAS/g)?.length).toBe(2);
    });

    it("genera un PDF valido", async () => {
      const buffer = await renderToBuffer((template as any)(PROPS));
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("no rompe con contenido minimo", async () => {
      const buffer = await renderToBuffer(
        (template as any)({ content: "Texto simple." }),
      );
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("pagina los documentos largos", async () => {
      const long = Array.from(
        { length: 150 },
        (_, index) => `Linea ${index}`,
      ).join("\n");
      const text = await renderPdf({
        content: long,
        fontSize: "lg",
      } as any);

      expect(text).toContain("Linea 149");
      expect(text).toContain("P\u00e1gina 2 de");
    });
  });

  describe("estilos", () => {
    it("h1 grande, negrita, centrado y con borde inferior", () => {
      expect(resolveStyles().h1).toMatchObject({
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        marginBottom: 20,
      });
    });

    it("h2 con color de acento y margenes", () => {
      expect(resolveStyles().h2).toMatchObject({
        fontSize: 16,
        fontWeight: "bold",
        color: accent,
        marginTop: 16,
        marginBottom: 8,
      });
    });

    it("parrafos con cuerpo 11 e interlineado 1.6", () => {
      expect(resolveStyles().paragraph).toMatchObject({
        fontSize: 11,
        lineHeight: 1.6,
        marginBottom: 12,
      });
    });

    it("listas con sangria de 20 y espaciado de 8", () => {
      expect(resolveStyles().list).toMatchObject({
        marginLeft: 20,
        marginBottom: 8,
      });
    });

    it("vinetas y numeros con el color de acento", () => {
      expect(resolveStyles().marker).toMatchObject({ color: accent });
      expect(resolveStyles().number).toMatchObject({
        fontWeight: "bold",
        color: accent,
      });
    });

    it("bloques con margen inferior y separador gris claro", () => {
      expect(resolveStyles().block).toMatchObject({ marginBottom: 20 });
      expect(resolveStyles().separator).toMatchObject({
        height: 1,
        backgroundColor: "#e5e7eb",
      });
    });

    it("header con logo y footer con borde superior", () => {
      expect(resolveStyles().logo).toMatchObject({ width: expect.any(Number) });
      expect(resolveStyles().header).toMatchObject({
        flexDirection: "row",
        borderBottomWidth: expect.any(Number),
      });
      expect(resolveStyles().footer).toMatchObject({
        position: "absolute",
        borderTopWidth: 1,
      });
      expect(resolveStyles().footerText).toMatchObject({ fontSize: 9 });
    });
  });

  describe("opciones de tema", () => {
    it("escala todos los cuerpos con el tamano de fuente", () => {
      expect(resolveStyles({ fontSize: "sm" }).paragraph).toMatchObject({
        fontSize: 9.9,
      });
      expect(resolveStyles({ fontSize: "lg" }).paragraph).toMatchObject({
        fontSize: 12.65,
      });
      expect(resolveStyles({ fontSize: "lg" }).h1).toMatchObject({
        fontSize: 27.6,
      });
      expect(resolveStyles({ fontSize: "lg" }).h2).toMatchObject({
        fontSize: 18.4,
      });
    });

    it("cambia el margen de la pagina", () => {
      expect(resolveStyles({ margin: "narrow" }).page).toMatchObject({
        paddingHorizontal: 36,
      });
      expect(resolveStyles({ margin: "normal" }).page).toMatchObject({
        paddingHorizontal: 56,
      });
      expect(resolveStyles({ margin: "wide" }).page).toMatchObject({
        paddingHorizontal: 72,
      });
    });

    it("aplica el color de acento elegido", () => {
      const styles = resolveStyles({ accentColor: "#b91c1c" });

      expect(styles.h2).toMatchObject({ color: "#b91c1c" });
      expect(styles.marker).toMatchObject({ color: "#b91c1c" });
      expect(styles.logo).toMatchObject({ backgroundColor: "#b91c1c" });
    });

    it("devuelve la misma instancia para el mismo tema", () => {
      expect(resolveStyles({ fontSize: "lg" })).toBe(
        resolveStyles({ fontSize: "lg" }),
      );
    });
  });
});
