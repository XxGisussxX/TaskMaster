/**
 * Tipo heredado del clasificador heurístico por línea. Conservado solo porque
 * el editor web (MarkdownEditor) lo usa para el resaltado del overlay; se
 * eliminará al migrar el editor a bloques Markdown reales (Fase 5, Bloque D).
 *
 * @deprecated
 */
export type DocumentSectionType =
  "heading" | "heading-2" | "paragraph" | "list-item" | "numbered-item";

const NUMBERED_ITEM_PATTERN = /^(\d+)\.\s+(\S.*)$/;
const BULLET_ITEM_PATTERN = /^(?:[-*+]|\u2022)\s+(\S.*)$/;

const MAX_HEADING_LENGTH = 120;
const MIN_HEADING_LENGTH = 2;

function isUppercaseHeading(line: string): boolean {
  if (line.length < MIN_HEADING_LENGTH || line.length > MAX_HEADING_LENGTH) {
    return false;
  }

  const letters = line.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) {
    return false;
  }

  const cased = letters.filter(
    (letter) => letter.toUpperCase() !== letter.toLowerCase(),
  );
  if (cased.length === 0) {
    return false;
  }

  return cased.every((letter) => letter === letter.toUpperCase());
}

/**
 * Clasificación heurística de una línea aislada. Reemplazada por la pipeline
 * Markdown en `./markdown`; conservada únicamente porque el editor web todavía
 * la usa en el overlay de resaltado. No usar en código nuevo.
 *
 * @deprecated
 */
export function classifyLine(line: string): DocumentSectionType {
  const trimmed = line.trim();

  if (NUMBERED_ITEM_PATTERN.test(trimmed)) {
    return "numbered-item";
  }
  if (BULLET_ITEM_PATTERN.test(trimmed)) {
    return "list-item";
  }
  if (isUppercaseHeading(trimmed)) {
    return "heading";
  }
  return "paragraph";
}
