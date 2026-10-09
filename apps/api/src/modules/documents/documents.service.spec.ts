import { describe, it, expect } from "vitest";
import type { DocumentTemplateType } from "@taskmaster/contracts";
import {
  generateDocumentSchema,
  MAX_DOCUMENT_CONTENT_CHARS,
} from "@taskmaster/contracts";
import { DocumentsService } from "./documents.service";

const templates: DocumentTemplateType[] = ["minimal", "corporate"];

const service = new DocumentsService();

const structuredContent = [
  "REPORTE DE VENTAS",
  "",
  "Resumen del trimestre.",
  "",
  "1. Introduccion",
  "",
  "- Metricas usadas",
].join("\n");

describe("DocumentsService.generatePdf", () => {
  it.each(templates)(
    "genera un PDF valido para la plantilla %s",
    async (template) => {
      const pdf = await service.generatePdf({
        content: structuredContent,
        template,
      });

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(1000);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    },
  );

  it("sigue aceptando texto plano sin formato", async () => {
    const pdf = await service.generatePdf({
      content: "Un parrafo comun, sin estructura.",
      template: "minimal",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("acepta contenido con saltos de linea y caracteres especiales", async () => {
    const pdf = await service.generatePdf({
      content: "TITULO CON Ñ Y Á\r\n\r\n- ñandú\r\n",
      template: "corporate",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("sigue funcionando sin enviar opciones", async () => {
    const pdf = await service.generatePdf({
      content: "Sin opciones.",
      template: "minimal",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("aplica las opciones de tema recibidas", async () => {
    const pdf = await service.generatePdf({
      content: "TITULO\n\nCuerpo del documento.",
      template: "corporate",
      fontSize: "lg",
      margin: "wide",
      accentColor: "#b91c1c",
      title: "Titulo Del Reporte",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("generateDocumentSchema (cap de content)", () => {
  it("acepta el maximo exacto de caracteres", () => {
    const result = generateDocumentSchema.safeParse({
      content: "a".repeat(MAX_DOCUMENT_CONTENT_CHARS),
      template: "minimal",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza contenido que excede el cap", () => {
    const result = generateDocumentSchema.safeParse({
      content: "a".repeat(MAX_DOCUMENT_CONTENT_CHARS + 1),
      template: "minimal",
    });

    expect(result.success).toBe(false);
  });

  it("sigue rechazando contenido vacio", () => {
    const result = generateDocumentSchema.safeParse({
      content: "",
      template: "minimal",
    });

    expect(result.success).toBe(false);
  });
});
