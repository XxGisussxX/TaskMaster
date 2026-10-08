import { z } from "zod";

export const documentTemplateTypeSchema = z.enum([
  "minimal",
  "corporate",
  "creative",
  "editorial",
  "dark",
]);

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
  content: z.string().min(1, "El contenido es requerido"),
  template: documentTemplateTypeSchema,
  ...documentOptionsSchema.shape,
});

export type GenerateDocumentInput = z.infer<typeof generateDocumentSchema>;
export type DocumentTemplateType = z.infer<typeof documentTemplateTypeSchema>;
export type FontSizeOption = z.infer<typeof fontSizeSchema>;
export type MarginOption = z.infer<typeof marginSchema>;
export type DocumentOptions = z.infer<typeof documentOptionsSchema>;
