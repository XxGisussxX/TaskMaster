/**
 * Configuración de plantillas (Fase 3–4): una plantilla es un preset de tema
 * (tipografía, densidad, jerarquía, acento) + layout (composición de página:
 * portada, índice, numeración, bloque de carta, variantes de cabecera/pie).
 * El motor de render (PdfRenderer) consume PdfTemplate + DocumentModel; no
 * existe lógica de presentación por plantilla.
 */

import { DEFAULT_ACCENT_COLOR } from "../theme";
import type { FontRole } from "../theme/tokens";

export type TemplateId =
  "minimal" | "corporate" | "editorial" | "carta" | "informe";

export type HeaderVariant = "minimal" | "brand" | "editorial";
export type FooterVariant = "page-date" | "page";

/** Aportación tipográfica de la plantilla al tema base. */
export interface TemplateTheme {
  /** Acento por defecto cuando la UI no envía uno. */
  accent: string;
  /** Si es true, la UI muestra el selector de color de acento. */
  usesAccent: boolean;
  bodyFont: FontRole;
  headingFont: FontRole;
  /** Multiplicador del espaciado entre bloques (1 = base, >1 más aire). */
  density: number;
  /** Multiplicador de los tamaños de titular (fuerza de jerarquía). */
  headingScale: number;
}

export interface TemplateLayout {
  /** Alineación del H1. */
  h1Align: "left" | "center";
  /** Regla bajo el H1. */
  h1Rule: boolean;
  h1RuleColor: "border" | "accent";
  /** H1/H2 en color de acento. */
  h1Accent: boolean;
  h2Accent: boolean;
  /** Regla fina bajo el H2. */
  h2Rule: boolean;
  /** Alineación de párrafos (justificado solo con guionización validada). */
  paragraphAlign: "left" | "justify";
  /** Capitular en el primer párrafo del documento. */
  dropCap: boolean;
  /** Encabezado de tabla con relleno de acento o solo texto en negrita. */
  tableHeaderFill: "accent" | "none";
  tableZebra: boolean;
  quoteBarColor: "border" | "accent";
  quoteBg: boolean;
  /** Cita con cuerpo grande y cursiva (blockquote destacado). */
  quoteLarge: boolean;
  /** Barra de acento a la izquierda de los bloques de código. */
  codeBar: boolean;
  listMarkerAccent: boolean;
  /** Portada opcional como primera página. */
  cover: boolean;
  /** Índice opcional con enlaces internos a H1/H2. */
  toc: boolean;
  /** Prefija los titulares con numeración jerárquica (1, 1.1, ...). */
  sectionNumbering: boolean;
  /** Bloque remitente/fecha/destinatario (carta formal). */
  letterBlock: boolean;
  /** Reduce todos los titulares a un único nivel visual. */
  singleHeadingLevel: boolean;
  header: HeaderVariant | null;
  /** Primera página (1-based) en la que aparece la cabecera. */
  headerFromPage: number;
  footer: FooterVariant | null;
}

export interface PdfTemplate {
  id: TemplateId;
  label: string;
  /** Título por defecto cuando el documento no aporta ninguno. */
  fallbackTitle: string;
  theme: TemplateTheme;
  layout: TemplateLayout;
}

export const MINIMAL_TEMPLATE: PdfTemplate = {
  id: "minimal",
  label: "Minimal",
  fallbackTitle: "Documento",
  theme: {
    accent: "#111827",
    usesAccent: true,
    bodyFont: "sans",
    headingFont: "sans",
    density: 1.2,
    headingScale: 0.92,
  },
  layout: {
    h1Align: "left",
    h1Rule: true,
    h1RuleColor: "border",
    h1Accent: false,
    h2Accent: false,
    h2Rule: false,
    paragraphAlign: "left",
    dropCap: false,
    tableHeaderFill: "none",
    tableZebra: false,
    quoteBarColor: "border",
    quoteBg: false,
    quoteLarge: false,
    codeBar: true,
    listMarkerAccent: true,
    cover: false,
    toc: false,
    sectionNumbering: false,
    letterBlock: false,
    singleHeadingLevel: false,
    header: "minimal",
    headerFromPage: 2,
    footer: "page-date",
  },
};

export const CORPORATE_TEMPLATE: PdfTemplate = {
  id: "corporate",
  label: "Corporate",
  fallbackTitle: "Corporate Document",
  theme: {
    accent: DEFAULT_ACCENT_COLOR,
    usesAccent: true,
    bodyFont: "sans",
    headingFont: "sans",
    density: 1,
    headingScale: 1,
  },
  layout: {
    h1Align: "center",
    h1Rule: true,
    h1RuleColor: "accent",
    h1Accent: true,
    h2Accent: true,
    h2Rule: false,
    paragraphAlign: "left",
    dropCap: false,
    tableHeaderFill: "accent",
    tableZebra: true,
    quoteBarColor: "accent",
    quoteBg: true,
    quoteLarge: false,
    codeBar: true,
    listMarkerAccent: true,
    cover: false,
    toc: false,
    sectionNumbering: false,
    letterBlock: false,
    singleHeadingLevel: false,
    header: "brand",
    headerFromPage: 2,
    footer: "page-date",
  },
};

export const EDITORIAL_TEMPLATE: PdfTemplate = {
  id: "editorial",
  label: "Editorial",
  fallbackTitle: "Documento editorial",
  theme: {
    accent: "#7c2d12",
    usesAccent: true,
    bodyFont: "serif",
    headingFont: "serif",
    density: 1.35,
    headingScale: 1.3,
  },
  layout: {
    h1Align: "left",
    h1Rule: true,
    h1RuleColor: "border",
    h1Accent: false,
    h2Accent: false,
    h2Rule: true,
    paragraphAlign: "left",
    dropCap: true,
    tableHeaderFill: "none",
    tableZebra: false,
    quoteBarColor: "accent",
    quoteBg: false,
    quoteLarge: true,
    codeBar: true,
    listMarkerAccent: false,
    cover: false,
    toc: false,
    sectionNumbering: false,
    letterBlock: false,
    singleHeadingLevel: false,
    header: "editorial",
    headerFromPage: 2,
    footer: "page-date",
  },
};

export const CARTA_TEMPLATE: PdfTemplate = {
  id: "carta",
  label: "Carta",
  fallbackTitle: "Carta",
  theme: {
    accent: "#111827",
    usesAccent: false,
    bodyFont: "serif",
    headingFont: "serif",
    density: 1.15,
    headingScale: 1,
  },
  layout: {
    h1Align: "left",
    h1Rule: false,
    h1RuleColor: "border",
    h1Accent: false,
    h2Accent: false,
    h2Rule: false,
    paragraphAlign: "left",
    dropCap: false,
    tableHeaderFill: "none",
    tableZebra: false,
    quoteBarColor: "border",
    quoteBg: false,
    quoteLarge: false,
    codeBar: false,
    listMarkerAccent: false,
    cover: false,
    toc: false,
    sectionNumbering: false,
    letterBlock: true,
    singleHeadingLevel: true,
    header: null,
    headerFromPage: Number.POSITIVE_INFINITY,
    footer: null,
  },
};

export const INFORME_TEMPLATE: PdfTemplate = {
  id: "informe",
  label: "Informe",
  fallbackTitle: "Informe",
  theme: {
    accent: DEFAULT_ACCENT_COLOR,
    usesAccent: true,
    bodyFont: "sans",
    headingFont: "sans",
    density: 1,
    headingScale: 1.15,
  },
  layout: {
    h1Align: "left",
    h1Rule: true,
    h1RuleColor: "accent",
    h1Accent: true,
    h2Accent: true,
    h2Rule: false,
    paragraphAlign: "left",
    dropCap: false,
    tableHeaderFill: "accent",
    tableZebra: true,
    quoteBarColor: "accent",
    quoteBg: true,
    quoteLarge: false,
    codeBar: true,
    listMarkerAccent: true,
    cover: true,
    toc: true,
    sectionNumbering: true,
    letterBlock: false,
    singleHeadingLevel: false,
    header: "brand",
    headerFromPage: 2,
    footer: "page-date",
  },
};

/** Registro único de plantillas disponibles. */
export const TEMPLATES: PdfTemplate[] = [
  MINIMAL_TEMPLATE,
  CORPORATE_TEMPLATE,
  EDITORIAL_TEMPLATE,
  CARTA_TEMPLATE,
  INFORME_TEMPLATE,
];

export const TEMPLATE_BY_ID: Record<TemplateId, PdfTemplate> = {
  minimal: MINIMAL_TEMPLATE,
  corporate: CORPORATE_TEMPLATE,
  editorial: EDITORIAL_TEMPLATE,
  carta: CARTA_TEMPLATE,
  informe: INFORME_TEMPLATE,
};
