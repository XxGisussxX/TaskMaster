import { FONT_CHAINS } from "../fonts";
import { DEFAULT_ACCENT_COLOR, FONT_SIZE_SCALES } from "../theme";
import type { FontSizeOption, MarginOption } from "../types";

/**
 * Tema del motor de documentos (Fase 2). Escala tipográfica 1.25 sobre un
 * cuerpo de 10.5pt / 1.55, espaciado en múltiplos de 4 y márgenes de página
 * que dejan 60–75 caracteres por línea en A4. Las plantillas pueden
 * sobrescribir colores/cadenas en su configuración (Fase 3).
 */

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
} as const;

export const THEME_COLORS = {
  text: "#1a1a1a",
  muted: "#6b7280",
  border: "#e5e7eb",
  surface: "#ffffff",
} as const;

export interface DocumentTheme {
  colors: {
    text: string;
    muted: string;
    border: string;
    accent: string;
    surface: string;
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
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function createDocumentTheme(
  options: CreateDocumentThemeOptions = {},
): DocumentTheme {
  const { accentColor, margin = "normal", fontSize = "md" } = options;
  const scale = FONT_SIZE_SCALES[fontSize];
  const scaled = (value: number): number => round2(value * scale);

  return {
    colors: {
      ...THEME_COLORS,
      accent: accentColor ?? DEFAULT_ACCENT_COLOR,
    },
    fonts: {
      body: [...FONT_CHAINS.body],
      heading: [...FONT_CHAINS.heading],
      mono: [...FONT_CHAINS.mono],
    },
    sizes: {
      body: scaled(BASE_TYPE_SIZES.body),
      h1: scaled(BASE_TYPE_SIZES.h1),
      h2: scaled(BASE_TYPE_SIZES.h2),
      h3: scaled(BASE_TYPE_SIZES.h3),
      h4: scaled(BASE_TYPE_SIZES.h4),
      small: scaled(BASE_TYPE_SIZES.small),
      caption: scaled(BASE_TYPE_SIZES.caption),
    },
    lineHeights: { ...THEME_LINE_HEIGHTS },
    spacing: {
      xs: scaled(BASE_SPACING.xs),
      sm: scaled(BASE_SPACING.sm),
      md: scaled(BASE_SPACING.md),
      lg: scaled(BASE_SPACING.lg),
      xl: scaled(BASE_SPACING.xl),
      blockBefore: scaled(BASE_SPACING.blockBefore),
      blockAfter: scaled(BASE_SPACING.blockAfter),
    },
    margin: PAGE_MARGIN_PADDINGS[margin],
  };
}
