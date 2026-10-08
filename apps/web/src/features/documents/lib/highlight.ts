import type { DocumentSectionType } from "@taskmaster/templates";

export interface LineStyle {
  text: string;
  className: string;
}

const HEADING_STYLE = "font-bold text-foreground";
const SUBHEADING_STYLE = "font-semibold text-foreground";
const LIST_STYLE = "text-primary";
const NUMBERED_STYLE = "text-primary";
const PARAGRAPH_STYLE = "text-muted-foreground";

export const PLACEHOLDER =
  "Pega tu texto aquí... Usa MAYÚSCULAS para títulos, - para listas, 1. 2. 3. para numeradas";

export function styleForLine(type: DocumentSectionType, line: string): string {
  switch (type) {
    case "heading":
      return HEADING_STYLE;
    case "heading-2":
      return SUBHEADING_STYLE;
    case "list-item":
      return LIST_STYLE;
    case "numbered-item":
      return NUMBERED_STYLE;
    default:
      return line.length > 0 ? PARAGRAPH_STYLE : "";
  }
}

export function lineNumbers(count: number): number[] {
  return Array.from({ length: Math.max(count, 1) }, (_, index) => index + 1);
}
