/**
 * Preprocesado previo al render (Fase 4): asigna anclas estables a los
 * titulares, calcula la numeración de secciones, marca la capitular y
 * recopila el índice. Todo puro y determinista para poder testearlo sin PDF.
 */

import { slugify } from "../markdown";
import type { Block, Inline } from "../markdown";

export interface TocEntry {
  id: string;
  title: string;
  level: 1 | 2;
}

export interface PrepareOptions {
  numbering: boolean;
  dropCap: boolean;
  toc: boolean;
}

export interface PreparedDocument {
  blocks: Block[];
  toc: TocEntry[];
}

function inlineText(children: Inline[]): string {
  return children
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.value;
        case "image":
          return node.alt ?? "";
        default:
          return inlineText(node.children);
      }
    })
    .join("")
    .trim();
}

export function prepareBlocks(
  blocks: Block[],
  options: PrepareOptions,
): PreparedDocument {
  const usedIds = new Map<string, number>();
  const toc: TocEntry[] = [];
  let major = 0;
  let minor = 0;
  let firstParagraphSeen = false;

  const prepared = blocks.map<Block>((block) => {
    if (block.type === "heading") {
      const text = inlineText(block.children);
      const base = block.id?.trim() || slugify(text) || "seccion";
      const seen = usedIds.get(base) ?? 0;
      usedIds.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;

      let number: string | undefined;
      if (options.numbering) {
        if (block.level === 1) {
          major += 1;
          minor = 0;
          number = String(major);
        } else if (block.level === 2) {
          minor += 1;
          number = `${major || 1}.${minor}`;
        }
      }

      if (options.toc && text && (block.level === 1 || block.level === 2)) {
        toc.push({
          id,
          title: number ? `${number}. ${text}` : text,
          level: block.level,
        });
      }

      return number ? { ...block, id, number } : { ...block, id };
    }

    if (block.type === "paragraph" && !firstParagraphSeen) {
      firstParagraphSeen = true;
      if (options.dropCap) {
        const first = block.children[0];
        if (first?.type === "text" && first.value.trim().length > 0) {
          return { ...block, dropCap: true };
        }
      }
    }

    return block;
  });

  return { blocks: prepared, toc };
}
