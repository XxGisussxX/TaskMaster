/**
 * Semantic document model. Produced from Markdown via `./parse` or from
 * plain text via `./normalize`. The rendering layer (theme + PdfRenderer)
 * consumes only this model — it never guesses about input syntax.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; url: string; title?: string; children: Inline[] }
  | { type: "image"; url: string; alt?: string; title?: string };

export type TableAlignment = "left" | "center" | "right";

export interface TableCell {
  /** A paragraph is a sequence of inline nodes (line breaks are text). */
  inlines: Inline[];
}

export interface TableRow {
  cells: TableCell[];
}

export interface ListItem {
  /** Present when the item is a GFM task item. */
  checked?: boolean;
  children: Block[];
}

export type Block =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4;
      children: Inline[];
      id?: string;
      /** Numeración de sección precalculada por el renderer (p. ej. "1.2"). */
      number?: string;
    }
  | {
      type: "paragraph";
      children: Inline[];
      /** Marcado por el renderer para la capitular del primer párrafo. */
      dropCap?: boolean;
    }
  | {
      type: "list";
      ordered: boolean;
      start: number;
      tight: boolean;
      items: ListItem[];
    }
  | {
      type: "table";
      /** One alignment per column; `null` means inherited / default. */
      align: (TableAlignment | null)[];
      header: TableRow;
      rows: TableRow[];
    }
  | { type: "code"; lang?: string; value: string }
  | { type: "blockquote"; children: Block[] }
  | { type: "thematicBreak" };

export interface DocumentModel {
  /** Derived from the source text; used for anchors / TOC / file naming. */
  title?: string;
  /** Front-matter opcional (Fase 4): solo se incluye cuando hay algún campo. */
  metadata?: import("./frontmatter").DocumentMetadata;
  blocks: Block[];
}

export type MarkdownMode = "markdown" | "plain" | "auto";

/** Normalized anchor id, MRI-free ("tildes", spaces, punctuation). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
