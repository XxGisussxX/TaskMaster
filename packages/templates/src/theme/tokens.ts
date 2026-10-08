import { FONT_CHAINS, FONT_FAMILY } from "../fonts";
import { DEFAULT_ACCENT_COLOR, FONT_SIZE_SCALES } from "../theme";
import type { FontSizeOption, MarginOption } from "../types";

/**
 * Tema del motor de documentos (Fase 2). Escala tipográfica 1.25 sobre un
 * cuerpo de 10.5pt / 1.55, espaciado en múltiplos de 4 y márgenes de página
 * que dejan 60–75 caracteres por línea en A4. Las plantillas (Fase 4) ajustan
 * además la familia (serif/sans), la densidad de espaciado y la fuerza de la
 * jerarquía de titulares.
 */

/** Rol tipográfico que elige la cadena de familias del tema. */
export type FontRole = "serif" | "sans";

const FONT_CHAIN_BY_ROLE: Record<FontRole, string[]> = {
  serif: [FONT_FAMILY.serif, FONT_FAMILY.sans, FONT_FAMILY.mono],
  sans: [FONT_FAMILY.sans, FONT_FAMILY.serif, FONT_FAMILY.mono],
};

export const PAGE_MARGIN_PADDINGS: Record<MarginOption, number> = {
  narrow: 80,
  normal: 104,
  wide: 128,
};

export const BASE_TYPE_SIZES = {
  body: 10.5,
  h1: 26,
  h2: 20.5,
  h3: 16,
  h4: 13,
  small: 9,
  caption: 8,
} as const;

export const BASE_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  blockBefore: 24,
  blockAfter: 8,
} as const;

export const THEME_LINE_HEIGHTS = {
  body: 1.55,
  heading: 1.2,
  table: 1.4,
  code: 1.45,
} as const;

export const THEME_COLORS = {
  text: "#1a1a1a",
  muted: "#6b7280",
  border: "#e5e7eb",
  surface: "#ffffff",
  codeBg: "#f3f4f6",
  quoteBg: "#f9fafb",
  zebra: "#f9fafb",
} as const;

export interface DocumentTheme {
  colors: {
    text: string;
    muted: string;
    border: string;
    accent: string;
    surface: string;
    codeBg: string;
    quoteBg: string;
    zebra: string;
  };
  fonts: {
    body: string[];
    heading: string[];
    mono: string[];
  };
  sizes: {
    body: number;
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    small: number;
    caption: number;
  };
  lineHeights: {
    body: number;
    heading: number;
    table: number;
    code: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    blockBefore: number;
    blockAfter: number;
  };
  /** Padding horizontal de página en puntos. */
  margin: number;
}

export interface CreateDocumentThemeOptions {
  accentColor?: string;
  margin?: MarginOption;
  fontSize?: FontSizeOption;
  /** Familia del cuerpo (por defecto serif). */
  bodyFont?: FontRole;
  /** Familia de los titulares (por defecto sans). */
  headingFont?: FontRole;
  /** Multiplicador de espaciado entre bloques (1 = base). */
  density?: number;
  /** Multiplicador de los tamaños de titular (1 = base). */
  headingScale?: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function createDocumentTheme(
  options: CreateDocumentThemeOptions = {},
): DocumentTheme {
  const {
    accentColor,
    margin = "normal",
    fontSize = "md",
    bodyFont = "serif",
    headingFont = "sans",
    density = 1,
    headingScale = 1,
  } = options;
  const scale = FONT_SIZE_SCALES[fontSize];
  const scaled = (value: number): number => round2(value * scale);
  const spaced = (value: number): number => round2(value * scale * density);
  const heading = (value: number): number =>
    round2(value * scale * headingScale);

  return {
    colors: {
      ...THEME_COLORS,
      accent: accentColor ?? DEFAULT_ACCENT_COLOR,
    },
    fonts: {
      body: [...FONT_CHAIN_BY_ROLE[bodyFont]],
      heading: [...FONT_CHAIN_BY_ROLE[headingFont]],
      mono: [...FONT_CHAINS.mono],
    },
    sizes: {
      body: scaled(BASE_TYPE_SIZES.body),
      h1: heading(BASE_TYPE_SIZES.h1),
      h2: heading(BASE_TYPE_SIZES.h2),
      h3: heading(BASE_TYPE_SIZES.h3),
      h4: heading(BASE_TYPE_SIZES.h4),
      small: scaled(BASE_TYPE_SIZES.small),
      caption: scaled(BASE_TYPE_SIZES.caption),
    },
    lineHeights: { ...THEME_LINE_HEIGHTS },
    spacing: {
      xs: spaced(BASE_SPACING.xs),
      sm: spaced(BASE_SPACING.sm),
      md: spaced(BASE_SPACING.md),
      lg: spaced(BASE_SPACING.lg),
      xl: spaced(BASE_SPACING.xl),
      blockBefore: spaced(BASE_SPACING.blockBefore),
      blockAfter: spaced(BASE_SPACING.blockAfter),
    },
    margin: PAGE_MARGIN_PADDINGS[margin],
  };
}
