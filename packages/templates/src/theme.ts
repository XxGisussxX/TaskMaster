import type { FontSizeOption } from "./types";

export const FONT_SIZE_SCALES: Record<FontSizeOption, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.15,
};

export const DEFAULT_ACCENT_COLOR = "#1e3a5f";

export function formatDocumentDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}
