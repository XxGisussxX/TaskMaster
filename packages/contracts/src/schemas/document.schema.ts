import { z } from "zod";

export const documentTemplateTypeSchema = z.enum(["minimal", "corporate"]);

/**
 * Tope del contenido markdown que se renderiza a PDF. 50k caracteres alcanzan
 * un documento largo (la plantilla de perf usa ~12k caracteres en 10 páginas),
 * y acota el costo del render react-pdf (CPU) y del body JSON del endpoint.
 */
export const MAX_DOCUMENT_CONTENT_CHARS = 50_000;

export const fontSizeSchema = z.enum(["sm", "md", "lg"]);
export const marginSchema = z.enum(["narrow", "normal", "wide"]);
export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido");

export const documentOptionsSchema = z.object({
  fontSize: fontSizeSchema.optional(),
  margin: marginSchema.optional(),
  accentColor: accentColorSchema.optional(),
  title: z.string().trim().max(200).optional(),
});

export const generateDocumentSchema = z.object({
  content: z
    .string()
    .min(1, "El contenido es requerido")
    .max(
      MAX_DOCUMENT_CONTENT_CHARS,
      `El contenido excede el máximo de ${MAX_DOCUMENT_CONTENT_CHARS.toLocaleString("es")} caracteres`,
    ),
  template: documentTemplateTypeSchema,
  ...documentOptionsSchema.shape,
});

export type GenerateDocumentInput = z.infer<typeof generateDocumentSchema>;
export type DocumentTemplateType = z.infer<typeof documentTemplateTypeSchema>;
export type FontSizeOption = z.infer<typeof fontSizeSchema>;
export type MarginOption = z.infer<typeof marginSchema>;
export type DocumentOptions = z.infer<typeof documentOptionsSchema>;
