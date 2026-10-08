export type DocumentSectionType =
  "heading" | "heading-2" | "paragraph" | "list-item" | "numbered-item";

export interface DocumentSection {
  type: DocumentSectionType;
  content: string;
}

export interface ParseOptions {
  subheadings?: boolean;
}

const NUMBERED_ITEM_PATTERN = /^(\d+)\.\s+(\S.*)$/;
const BULLET_ITEM_PATTERN = /^(?:[-*+]|\u2022)\s+(\S.*)$/;
const TRAILING_PUNCTUATION_PATTERN = /[.!?,;:]$/;
const MINOR_WORDS = new Set([
  "a",
  "al",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "the",
  "of",
  "y",
]);

const MAX_HEADING_LENGTH = 120;
const MIN_HEADING_LENGTH = 2;
const MAX_SUBHEADING_WORDS = 6;

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

function isSubheading(line: string): boolean {
  if (
    line.length > MAX_HEADING_LENGTH ||
    TRAILING_PUNCTUATION_PATTERN.test(line)
  ) {
    return false;
  }

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_SUBHEADING_WORDS) {
    return false;
  }

  const meaningful = words.filter(
    (word) => !MINOR_WORDS.has(word.toLowerCase()),
  );
  if (meaningful.length === 0) {
    return false;
  }

  return meaningful.every((word) => {
    const first = word[0] as string;
    return first === first.toUpperCase() && first !== first.toLowerCase();
  });
}

function toSection(line: string, subheadings: boolean): DocumentSection {
  const numbered = line.match(NUMBERED_ITEM_PATTERN);
  if (numbered) {
    return { type: "numbered-item", content: line };
  }

  const bullet = line.match(BULLET_ITEM_PATTERN);
  if (bullet) {
    return { type: "list-item", content: (bullet[1] ?? "").trim() };
  }

  if (isUppercaseHeading(line)) {
    return { type: "heading", content: line };
  }

  if (subheadings && isSubheading(line)) {
    return { type: "heading-2", content: line };
  }

  return { type: "paragraph", content: line };
}

/**
 * Legacy heuristic classification. Replaced by the Markdown pipeline in
 * `./markdown` (unified + remark). Kept for backward compatibility until the
 * migration is complete; do not use in new code.
 *
 * @deprecated Use `parseMarkdown` from `./markdown/parse` instead.
 */
export function classifyLine(line: string): DocumentSectionType {
  return toSection(line.trim(), false).type;
}

/**
 * Legacy heuristic parser: uppercase = H1, Title-Case short line = H2, and no
 * support for tables, code blocks, or inline emphasis. Superseded by
 * `./markdown/parse` (real Markdown via unified + remark-parse + remark-gfm).
 *
 * @deprecated
 */
export function parseMarkdown(
  content: string,
  { subheadings = false }: ParseOptions = {},
): DocumentSection[] {
  if (!content) {
    return [];
  }

  const sections: DocumentSection[] = [];

  for (const rawLine of content.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    const section = toSection(line, subheadings);
    const previous = sections[sections.length - 1];

    if (section.type === "paragraph" && previous?.type === "paragraph") {
      previous.content = `${previous.content}\n${section.content}`;
      continue;
    }

    sections.push(section);
  }

  return sections;
}

export default parseMarkdown;
