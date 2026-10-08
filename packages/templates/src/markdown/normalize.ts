import type {
  Block,
  DocumentModel,
  Inline,
  ListItem,
  TableAlignment,
} from "./model";

/**
 * Heuristics for documents written as "plain text" (no Markdown syntax).
 *
 * Rules implemented here (as specified):
 * - ALL-CAPS line of 2-120 chars without lowercase → H1.
 * - Title-Case line of <= 6 words, no trailing punctuation, with a blank
 *   line before AND after, not the first/last block of the document, next
 *   block being a paragraph or a list → H2. Greetings / sign-offs /
 *   signatures are excluded via a configurable blocklist (ES + EN by
 *   default).
 * - `-`, `*`, `+`, `•` bullet → unordered list item (marker stripped).
 * - `\d+.` or `\d.)` → ordered list item (number kept).
 * - `- [ ]` / `- [x]` → task item.
 * - Lines with `|` pipes, tabs or 2+ spaces → table. An optional separator
 *   row (`---` / `:---:` / `---:`) sets column alignment. A block of 3+
 *   lines with an identical whitespace column count also becomes a table
 *   (see `tryAlignedTable`).
 * - ``` fences → code block (language kept); `> ` → blockquote;
 *   `---` / `***` / `___` on their own line → thematic break.
 *
 * Nested lists and inline emphasis are NOT inferred in plain mode; the
 * writer is expected to switch to Markdown for those.
 */
export interface PlainTextOptions {
  /** First-word terms (lowercased) that suppress H2 detection. */
  greetingBlocklist?: string[];
}

const DEFAULT_BLOCKLIST = [
  "querida",
  "querido",
  "hola",
  "estimado",
  "estimada",
  "atentamente",
  "cordialmente",
  "afectuosamente",
  "saludos",
  "reciba",
  "un",
  "muchas",
  "gracias",
  "att",
  "dear",
  "hi",
  "hello",
  "regards",
  "sincerely",
  "best",
  "thanks",
];

const H1_RE = /^[A-Z0-9ÁÉÍÓÚÑÜ &@%'".,:;()-]{2,120}$/;
const H2_RE = /^[A-ZÁÉÍÓÚÑÜ][^!?.:]*$/;
const ORDERED_RE = /^(\d{1,3})[.)]\s+(.*)$/;
const FENCE_RE = /^```\s*(\w*)\s*$/;
const THEMATIC_RE = /^(\*\*\*|---|___)\s*$/;
const SEPARATOR_RE = /^:?-+:?$/;
export const MARKDOWN_SYNTAX_RE =
  /(```|\*\*|__|#{1,6}\s|\[[^\]]*\]\([^)]*\)|^\s*>\s|^\s*[-*+]\s*\[[ xX]\])/m;

/** Safe access for `noUncheckedIndexedAccess`: out-of-range reads as "". */
function at(lines: string[], index: number): string {
  return lines[index] ?? "";
}

export function detectMarkdown(source: string): boolean {
  if (/```/.test(source)) return true;
  if (/#{1,6}\s/.test(source)) return true;
  if (/\*\*|__/.test(source)) return true;
  if (/\[[^\]\n]*\]\([^)\n]*\)/.test(source)) return true;
  if (/^\s*>\s/m.test(source)) return true;
  if (/^\s*[-*+]\s*\[[ xX]\]/m.test(source)) return true;
  if (/^\s*\|/m.test(source)) return true;
  if (/^[^\n|]+\|[^\n|]+/m.test(source)) return true;
  return false;
}

function inlineText(value: string): Inline {
  return { type: "text", value };
}

export function parsePlainText(
  source: string,
  options: PlainTextOptions = {},
): DocumentModel {
  const blocklist = options.greetingBlocklist ?? DEFAULT_BLOCKLIST;
  const lines = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks: Block[] = [];

  let i = 0;

  while (i < lines.length) {
    const trimmed = at(lines, i).trim();
    if (trimmed.length === 0) {
      i += 1;
      continue;
    }

    const fence = trimmed.match(FENCE_RE);
    if (fence) {
      const lang = (fence[1] ?? "") || undefined;
      const value: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(at(lines, i).trim())) {
        value.push(at(lines, i));
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang, value: value.join("\n") });
      continue;
    }

    if (THEMATIC_RE.test(trimmed)) {
      blocks.push({ type: "thematicBreak" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quoted: string[] = [];
      while (
        i < lines.length &&
        (at(lines, i).trim() === "" || at(lines, i).trim().startsWith("> "))
      ) {
        const q = at(lines, i).trim();
        if (q) quoted.push(q.slice(2));
        i += 1;
      }
      const inner = parsePlainText(quoted.join("\n"), options);
      blocks.push({ type: "blockquote", children: inner.blocks });
      continue;
    }

    const table = tryTable(lines, i);
    if (table) {
      blocks.push({
        type: "table",
        align: table.align,
        header: {
          cells: table.header.map((cell) => ({ inlines: [inlineText(cell)] })),
        },
        rows: table.rows.map((row) => ({
          cells: row.map((cell) => ({ inlines: [inlineText(cell)] })),
        })),
      });
      i += table.consumed;
      continue;
    }

    const bullet = trimmed.match(/^\s*[-*+•]\s+(.*)$/);
    if (bullet) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const t = at(lines, i).trim();
        const b = t.match(/^\s*[-*+•]\s+(.*)$/);
        if (!b) break;
        const check = (b[1] ?? "").match(/^\[([ xX])\]\s+(.*)$/);
        items.push({
          ...(check ? { checked: check[1] !== " " } : {}),
          children: [
            {
              type: "paragraph",
              children: [inlineText(check ? (check[2] ?? "") : (b[1] ?? ""))],
            },
          ],
        });
        i += 1;
      }
      blocks.push({
        type: "list",
        ordered: false,
        start: 1,
        tight: true,
        items,
      });
      continue;
    }

    const ordered = trimmed.match(ORDERED_RE);
    if (ordered) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const m = at(lines, i).trim().match(ORDERED_RE);
        if (!m) break;
        items.push({
          children: [{ type: "paragraph", children: [inlineText(m[2] ?? "")] }],
        });
        i += 1;
      }
      blocks.push({
        type: "list",
        ordered: true,
        start: Number.parseInt(ordered[1] ?? "1", 10),
        tight: true,
        items,
      });
      continue;
    }

    const isH1 =
      H1_RE.test(trimmed) &&
      !/[a-záéíóúñü]/.test(trimmed) &&
      !!trimmed.match(/[A-ZÁÉÍÓÚÑÜ]/);
    if (isH1) {
      blocks.push({
        type: "heading",
        level: 1,
        children: [inlineText(trimmed)],
      });
      i += 1;
      continue;
    }

    if (isH2Candidate(trimmed, lines, i, blocklist)) {
      blocks.push({
        type: "heading",
        level: 2,
        children: [inlineText(trimmed)],
      });
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [at(lines, i)];
    i += 1;
    while (
      i < lines.length &&
      at(lines, i).trim() !== "" &&
      !FENCE_RE.test(at(lines, i).trim())
    ) {
      paragraphLines.push(at(lines, i));
      i += 1;
    }
    blocks.push({
      type: "paragraph",
      children: [{ type: "text", value: paragraphLines.join("\n").trim() }],
    });
  }

  return { title: titleFromBlocks(blocks), blocks };
}

function titleFromBlocks(blocks: Block[]): string | undefined {
  const first = blocks[0];
  if (first?.type === "heading") {
    return first.children
      .map((c) => (c.type === "text" ? c.value : ""))
      .join("")
      .trim();
  }
  return undefined;
}

function isH2Candidate(
  trimmed: string,
  lines: string[],
  index: number,
  blocklist: string[],
): boolean {
  if (!H2_RE.test(trimmed)) return false;
  if (!/[a-záéíóúñü]/.test(trimmed)) return false; // ALL-CAPS is H1 territory
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 6) return false;
  // Must be preceded by a blank line and must not be the first block.
  if (index === 0 || at(lines, index - 1).trim() !== "") return false;
  // Must be followed by a blank line.
  if (at(lines, index + 1).trim() !== "") return false;
  // Not the last block of the document: the block after the blank line must
  // be a paragraph, a list or a table. (Deviation from the strict spec that
  // only allowed paragraph/list: table headers are a common, legitimate
  // section title, e.g. "Clasificacion final" followed by a standings table.)
  if (at(lines, index + 2).trim() === "") return false;
  const blocker = (words[0] ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");
  if (blocklist.includes(blocker)) return false;
  return true;
}

interface ParsedTable {
  align: (TableAlignment | null)[];
  header: string[];
  rows: string[][];
  consumed: number;
}

/** Lines that belong to another block type than a space-aligned table. */
function isStructureLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (/^\s*[-*+•]\s+/.test(line)) return false;
  if (ORDERED_RE.test(trimmed)) return false;
  if (trimmed.startsWith(">")) return false;
  if (FENCE_RE.test(trimmed) || THEMATIC_RE.test(trimmed)) return false;
  return true;
}

function tryTable(lines: string[], start: number): ParsedTable | null {
  const chunk: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = at(lines, i);
    if (line.trim() === "" || !looksTabular(line)) break;
    if (FENCE_RE.test(line.trim()) || THEMATIC_RE.test(line.trim())) break;
    chunk.push(line);
    i += 1;
  }
  if (chunk.length === 0) return tryAlignedTable(lines, start);

  const parsed = chunk.map(splitCells);
  const maxColumns = Math.max(...parsed.map((cells) => cells.length), 1);

  let align: (TableAlignment | null)[] = Array<TableAlignment | null>(
    maxColumns,
  ).fill(null);
  let headerIndex = 0;
  if (
    parsed.length >= 2 &&
    (parsed[1] ?? []).every((cell) => SEPARATOR_RE.test(cell.trim()))
  ) {
    align = (parsed[1] ?? []).map((cell) => cellToAlignment(cell));
    headerIndex = 1;
  }
  return {
    align,
    header: parsed[0] ?? [],
    rows: parsed.slice(headerIndex + 1),
    consumed: chunk.length,
  };
}

/**
 * Plain-text tables pasted with single spaces between columns (no pipes,
 * no tabs, no double-space alignment). Detection requires a blank-line
 * delimited block of at least 3 consecutive non-structural lines that all
 * split into the SAME number of whitespace-separated columns (>= 2).
 * Assumption: real prose wrapped at ~70 chars almost never lands on 3+
 * consecutive lines with an identical word count, so that is the signal.
 */
function tryAlignedTable(lines: string[], start: number): ParsedTable | null {
  let end = start;
  while (end < lines.length && isStructureLine(at(lines, end))) end += 1;
  const block = lines.slice(start, end);
  if (block.length < 3) return null;

  const cells = block.map((line) => line.trim().split(/\s+/));
  const columns = (cells[0] ?? []).length;
  if (columns < 2) return null;
  if (!cells.every((row) => row.length === columns)) return null;

  return {
    align: Array<TableAlignment | null>(columns).fill(null),
    header: cells[0] ?? [],
    rows: cells.slice(1),
    consumed: block.length,
  };
}

function cellToAlignment(cell: string): TableAlignment | null {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function splitCells(line: string): string[] {
  if (line.includes("|") || line.trim().startsWith("|")) {
    const trimmed = line.trim();
    const unwrapped = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    return unwrapped.split("|").map((cell) => cell.trim());
  }
  if (/\t/.test(line)) {
    return line.split("\t").map((cell) => cell.trim());
  }
  return line.split(/\s{2,}/).map((cell) => cell.trim());
}

function looksTabular(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.includes("|")) return true;
  if (/\t/.test(trimmed)) return true;
  return /\s{2,}/.test(trimmed) && line.startsWith(" ") === false;
}
