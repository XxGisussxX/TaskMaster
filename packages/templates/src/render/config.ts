/**
 * Configuración de plantillas (Fase 3): una plantilla es un preset de
 * composición, no un componente con estilos propios. El motor de render
 * (PdfRenderer) consume el DocumentModel + DocumentTheme + TemplateLayout;
 * no existe lógica de presentación fuera de src/render.
 */

import { DEFAULT_ACCENT_COLOR } from "../theme";

export type HeaderVariant = "minimal" | "brand";

export interface TemplateLayout {
  /** Alineación del H1 (justificar solo con guionización validada: no aplica). */
  h1Align: "left" | "center";
  /** Regla fina bajo el H1. */
  h1Rule: boolean;
  h1RuleColor: "border" | "accent";
  /** H1 en color de acento. */
  h1Accent: boolean;
  h2Accent: boolean;
  /** Cabecera de página desde la página 2 (o en la 1 si el título es explícito). */
  header: HeaderVariant | null;
  /** Alineación de párrafos: Fase 3 = "left" en todas las plantillas. */
  paragraphAlign: "left" | "justify";
  /** Encabezado de tabla con relleno de acento o solo texto en negrita. */
  tableHeaderFill: "accent" | "none";
  tableZebra: boolean;
  quoteBarColor: "border" | "accent";
  quoteBg: boolean;
  /** Barra de acento a la izquierda de los bloques de código. */
  codeBar: boolean;
  listMarkerAccent: boolean;
}

export interface TemplateDefinition {
  name: string;
  /** Acento por defecto cuando la UI no envía uno. */
  defaultAccent: string;
  fallbackTitle: string;
  layout: TemplateLayout;
}

export const MINIMAL_TEMPLATE: TemplateDefinition = {
  name: "minimal",
  defaultAccent: "#111827",
  fallbackTitle: "Documento",
  layout: {
    h1Align: "center",
    h1Rule: true,
    h1RuleColor: "border",
    h1Accent: false,
    h2Accent: true,
    header: "minimal",
    paragraphAlign: "left",
    tableHeaderFill: "none",
    tableZebra: false,
    quoteBarColor: "border",
    quoteBg: false,
    codeBar: true,
    listMarkerAccent: true,
  },
};

export const CORPORATE_TEMPLATE: TemplateDefinition = {
  name: "corporate",
  defaultAccent: DEFAULT_ACCENT_COLOR,
  fallbackTitle: "Corporate Document",
  layout: {
    h1Align: "center",
    h1Rule: true,
    h1RuleColor: "accent",
    h1Accent: true,
    h2Accent: true,
    header: "brand",
    paragraphAlign: "left",
    tableHeaderFill: "accent",
    tableZebra: true,
    quoteBarColor: "accent",
    quoteBg: true,
    codeBar: true,
    listMarkerAccent: true,
  },
};
