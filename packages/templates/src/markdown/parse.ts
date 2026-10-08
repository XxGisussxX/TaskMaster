import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type {
  BlockContent,
  Definition,
  Heading,
  List,
  ListItem,
  PhrasingContent,
  Root,
  Table,
} from "mdast";
import type {
  DocumentModel,
  Block,
  Inline,
  ListItem as ListItemModel,
  MarkdownMode,
  TableAlignment,
} from "./model";
import { detectMarkdown, parsePlainText } from "./normalize";
import { hasMetadata, parseFrontMatter } from "./frontmatter";
import { slugify } from "./model";

/**
 * Full Markdown pipeline. Supports headings 1-4, bold/italic/code/link/image
 * inlines, nested ordered/unordered lists with GFM task items, tables with
 * per-column alignment, fenced code blocks (with language), blockquotes and
 * thematic breaks. Soft line breaks inside a paragraph are kept as text
 * `"\n"` nodes so the renderer decides how to wrap them.
 *
 * An optional front-matter block at the top (see `./frontmatter`) is stripped
 * before parsing and attached as `model.metadata`.
 */
export function parseMarkdown(
  source: string,
  mode: MarkdownMode = "markdown",
): DocumentModel {
  const { data, body } = parseFrontMatter(source);
  const metadata = hasMetadata(data) ? data : undefined;
  const resolved = resolveMode(body, mode);
  if (resolved === "plain") {
    const model = parsePlainText(body);
    return metadata ? { ...model, metadata } : model;
  }

  const root = unified().use(remarkParse).use(remarkGfm).parse(body);

  const definitions = collectDefinitions(root);
  const blocks = root.children
    .filter((child) => child.type !== "definition")
    .map((child) => blockFromMdast(child as BlockContent, definitions))
    .filter((block): block is Block => block !== null);

  return {
    title: titleFromBlocks(blocks),
    ...(metadata ? { metadata } : {}),
    blocks,
  };
}

function resolveMode(source: string, mode: MarkdownMode): "markdown" | "plain" {
  if (mode === "auto") return detectMarkdown(source) ? "markdown" : "plain";
  return mode;
}

function collectDefinitions(root: Root): Map<string, Definition> {
  const map = new Map<string, Definition>();
  for (const child of root.children) {
    if (child.type === "definition" && child.label) {
      map.set(child.label.toLowerCase(), child);
    }
  }
  return map;
}

function titleFromBlocks(blocks: Block[]): string | undefined {
  const first = blocks[0];
  if (first?.type === "heading") {
    return flattenInline(first.children)
      .map((n) => (n.type === "text" ? n.value : ""))
      .join("")
      .trim();
  }
  return undefined;
}

function blockFromMdast(
  node: BlockContent,
  definitions: Map<string, Definition>,
): Block | null {
  switch (node.type) {
    case "heading":
      return headingFromMdast(node, definitions);
    case "paragraph":
      return {
        type: "paragraph" as const,
        children: node.children.map((child) =>
          inlineFromMdast(child, definitions),
        ),
      };
    case "list":
      return listFromMdast(node, definitions);
    case "table":
      return tableFromMdast(node, definitions);
    case "code":
      return {
        type: "code" as const,
        lang: node.lang ?? undefined,
        value: node.value,
      };
    case "blockquote":
      return {
        type: "blockquote" as const,
        children: node.children
          .map((child) => blockFromMdast(child as BlockContent, definitions))
          .filter((block): block is Block => block !== null),
      };
    case "thematicBreak":
      return { type: "thematicBreak" as const };
    default:
      return null;
  }
}

function headingFromMdast(
  node: Heading,
  definitions: Map<string, Definition>,
): Extract<Block, { type: "heading" }> {
  const level = Math.min(4, Math.max(1, node.depth)) as 1 | 2 | 3 | 4;
  const text = node.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("")
    .trim();
  return {
    type: "heading",
    level,
    ...(text ? { id: slugify(text) } : {}),
    children: node.children.map((child) => inlineFromMdast(child, definitions)),
  };
}

function listFromMdast(
  node: List,
  definitions: Map<string, Definition>,
): Extract<Block, { type: "list" }> {
  const items: ListItemModel[] = node.children.map((item) =>
    listItemFromMdast(item, definitions),
  );
  return {
    type: "list",
    ordered: node.ordered ?? false,
    start: node.start ?? 1,
    tight: items.every((item) => item.children.length <= 1),
    items,
  };
}

function listItemFromMdast(
  item: ListItem,
  definitions: Map<string, Definition>,
): ListItemModel {
  return {
    ...(item.checked === true || item.checked === false
      ? { checked: item.checked }
      : {}),
    children: item.children
      .map((child) => blockFromMdast(child as BlockContent, definitions))
      .filter((block): block is Block => block !== null),
  };
}

interface MdTableCell {
  type: "tableCell";
  children: PhrasingContent[];
}

function tableFromMdast(
  node: Table,
  definitions: Map<string, Definition>,
): Extract<Block, { type: "table" }> {
  const align: (TableAlignment | null)[] = (node.align ?? []).map((a) =>
    a ? (a as TableAlignment) : null,
  );
  const rows = node.children.map((row) => ({
    cells: row.children.map((cell) =>
      cellFromMdast(cell as MdTableCell, definitions),
    ),
  }));
  const [header, ...rest] = rows;
  return {
    type: "table",
    align,
    header: header ?? { cells: [] },
    rows: rest,
  };
}

function cellFromMdast(
  cell: MdTableCell,
  definitions: Map<string, Definition>,
): { inlines: Inline[] } {
  return {
    inlines: cell.children.map((child) => inlineFromMdast(child, definitions)),
  };
}

function inlineFromMdast(
  node: PhrasingContent,
  definitions: Map<string, Definition>,
): Inline {
  switch (node.type) {
    case "text":
      return { type: "text", value: node.value };
    case "break":
      return { type: "text", value: "\n" };
    case "strong":
      return {
        type: "bold",
        children: node.children.map((child) =>
          inlineFromMdast(child, definitions),
        ),
      };
    case "emphasis":
      return {
        type: "italic",
        children: node.children.map((child) =>
          inlineFromMdast(child, definitions),
        ),
      };
    case "inlineCode":
      return { type: "code", value: node.value };
    case "delete":
      return {
        type: "text",
        value: node.children
          .filter((c) => c.type === "text")
          .map((c) => c.value)
          .join(""),
      };
    case "link":
      return {
        type: "link",
        url: node.url,
        title: node.title ?? undefined,
        children: node.children.map((child) =>
          inlineFromMdast(child, definitions),
        ),
      };
    case "linkReference": {
      const definition = node.label
        ? definitions.get(node.label.toLowerCase())
        : undefined;
      if (!definition) return { type: "text", value: "" };
      return {
        type: "link",
        url: definition.url,
        title: definition.title ?? undefined,
        children: node.children.map((child) =>
          inlineFromMdast(child, definitions),
        ),
      };
    }
    case "image":
      return {
        type: "image",
        url: node.url,
        alt: node.alt ?? undefined,
        title: node.title ?? undefined,
      };
    case "imageReference": {
      const definition = node.label
        ? definitions.get(node.label.toLowerCase())
        : undefined;
      if (!definition) return { type: "text", value: "" };
      return { type: "image", url: definition.url, alt: node.alt ?? undefined };
    }
    case "html":
      return { type: "text", value: node.value };
    case "footnoteReference":
      return { type: "text", value: "" };
    default:
      return { type: "text", value: "" };
  }
}

function flattenInline(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inline of inlines) {
    if (
      inline.type === "text" ||
      inline.type === "code" ||
      inline.type === "image"
    ) {
      out.push(inline);
    } else if ("children" in inline) {
      out.push(...flattenInline(inline.children));
    }
  }
  return out;
}
