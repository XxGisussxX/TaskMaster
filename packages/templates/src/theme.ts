import type { FontSizeOption, MarginOption } from "./types";

export const FONT_SIZE_SCALES: Record<FontSizeOption, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.15,
};

export const MARGIN_PADDINGS: Record<MarginOption, number> = {
  narrow: 36,
  normal: 56,
  wide: 72,
};

export const DEFAULT_ACCENT_COLOR = "#1e3a5f";
export const DEFAULT_FONT_SIZE = 11;
export const DEFAULT_LINE_HEIGHT = 1.6;

export interface ResolvedTheme {
  accent: string;
  padding: number;
  fontSize: number;
  headingFontSize: number;
  subheadingFontSize: number;
  lineHeight: number;
}

interface ResolveThemeInput {
  fontSize?: FontSizeOption;
  margin?: MarginOption;
  accentColor?: string;
  defaultAccent?: string;
  baseFontSize?: number;
}

export function resolveTheme({
  fontSize,
  margin,
  accentColor,
  defaultAccent,
  baseFontSize,
}: ResolveThemeInput = {}): ResolvedTheme {
  const scale = (fontSize && FONT_SIZE_SCALES[fontSize]) || 1;
  const size = baseFontSize ?? DEFAULT_FONT_SIZE;
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    accent: accentColor ?? defaultAccent ?? DEFAULT_ACCENT_COLOR,
    padding: (margin && MARGIN_PADDINGS[margin]) || MARGIN_PADDINGS.normal,
    fontSize: round(size * scale),
    headingFontSize: round(24 * scale),
    subheadingFontSize: round(16 * scale),
    lineHeight: DEFAULT_LINE_HEIGHT,
  };
}

export function formatDocumentDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}
