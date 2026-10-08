import { describe, it, expect } from "vitest";
import { Fragment } from "react";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import { parseMarkdown } from "./markdown";
import { createDocumentTheme } from "./theme/tokens";
import { createTemplateStyles } from "./render/styles";
import type { TemplateStyles } from "./render/styles";
import { Blocks } from "./render/blocks";
import { MINIMAL_TEMPLATE } from "./render/config";

const CONTENT = [
  "# REPORTE DE VENTAS",
  "",
  "## Resumen Ejecutivo",
  "",
  "Parrafo de apertura.",
  "",
  "- Metricas usadas",
  "",
  "## OTRA SECCION",
  "",
  "1. Introduccion",
  "",
  "---",
  "",
  "Cierre del documento.",
].join("\n");

const theme = createDocumentTheme({
  accentColor: MINIMAL_TEMPLATE.theme.accent,
  bodyFont: MINIMAL_TEMPLATE.theme.bodyFont,
  headingFont: MINIMAL_TEMPLATE.theme.headingFont,
  density: MINIMAL_TEMPLATE.theme.density,
  headingScale: MINIMAL_TEMPLATE.theme.headingScale,
});
const styles: TemplateStyles = createTemplateStyles(
  theme,
  MINIMAL_TEMPLATE.layout,
);

interface TextBlock {
  text: string;
  style: unknown;
}

function isFragment(type: unknown): boolean {
  return (
    type === Fragment ||
    (typeof type === "symbol" && String(type) === "Symbol(react.fragment)")
  );
}

/**
 * Resuelve la función de los componentes a elementos host (Text/View) o
 * cadenas: Blocks/BlockNode/Inlines son componentes puros sin hooks, por lo
 * que invocarlos directamente con sus props reproduce el subárbol final.
 */
function resolve(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) {
    return node.flatMap(resolve);
  }
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (!isValidElement(node)) {
    return [];
  }
  const { type, props } = node as {
    type: unknown;
    props: { children?: ReactNode };
  };
  if (typeof type === "function") {
    return resolve((type as (props: unknown) => ReactNode)(props));
  }
  if (isFragment(type)) {
    return resolve(props.children);
  }
  return [node];
}

function textBlocks(node: ReactNode, blocks: TextBlock[] = []): TextBlock[] {
  for (const child of resolve(node)) {
    if (typeof child === "string") {
      continue;
    }
    if (!isValidElement(child)) {
      continue;
    }

    const props = child.props as { children?: ReactNode; style?: unknown };
    const children = resolve(props.children);
    const hasElementChild = children.some((entry) => isValidElement(entry));
    const directText = children
      .filter((entry): entry is string => typeof entry === "string")
      .join("");

    if (directText.length > 0 || !hasElementChild) {
      blocks.push({ text: directText, style: props.style });
    }

    children.forEach((entry) => {
      if (isValidElement(entry)) {
        textBlocks(entry, blocks);
      }
    });
  }
  return blocks;
}

function stylesMatch(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual ?? null) === JSON.stringify(expected ?? null);
}

function includesStyle(style: unknown, target: unknown): boolean {
  return (
    Array.isArray(style) && style.some((entry) => stylesMatch(entry, target))
  );
}

function rendered() {
  const model = parseMarkdown(CONTENT);
  return {
    model,
    blocks: textBlocks(
      Blocks({
        blocks: model.blocks,
        ctx: { theme, styles, layout: MINIMAL_TEMPLATE.layout, depth: 0 },
      }),
    ),
  };
}

describe("markdown -> bloques semánticos", () => {
  it("convierte la jerarquia del documento en bloques ordenados", () => {
    const { model } = rendered();
    const types = model.blocks.map((block) => block.type);
    expect(types).toEqual([
      "heading",
      "heading",
      "paragraph",
      "list",
      "heading",
      "list",
      "thematicBreak",
      "paragraph",
    ]);
  });

  it("el primer titular es el titulo del documento", () => {
    expect(rendered().model.title).toBe("REPORTE DE VENTAS");
  });

  it("devuelve bloques vacios para contenido vacio", () => {
    const model = parseMarkdown("");
    expect(model.blocks).toEqual([]);
    expect(
      textBlocks(
        Blocks({
          blocks: [],
          ctx: { theme, styles, layout: MINIMAL_TEMPLATE.layout, depth: 0 },
        }),
      ),
    ).toEqual([]);
  });
});

describe("render de bloques (Blocks)", () => {
  it("renderiza un elemento de texto por bloque en orden", () => {
    const texts = rendered().blocks.map((block) => block.text);
    expect(texts).toEqual([
      "REPORTE DE VENTAS",
      "Resumen Ejecutivo",
      "Parrafo de apertura.",
      "\u2022",
      "Metricas usadas",
      "OTRA SECCION",
      "1.",
      "Introduccion",
      "",
      "Cierre del documento.",
    ]);
  });

  it("aplica el estilo de h1 al primer nivel", () => {
    const block = rendered().blocks.find(
      (entry) => entry.text === "REPORTE DE VENTAS",
    );
    expect(stylesMatch(block?.style, styles.h1)).toBe(true);
  });

  it("aplica el estilo de h2 a los nivel 2", () => {
    const block = rendered().blocks.find(
      (entry) => entry.text === "Resumen Ejecutivo",
    );
    expect(stylesMatch(block?.style, styles.h2)).toBe(true);
  });

  it("aplica el estilo de parrafo al texto suelto", () => {
    const paragraph = rendered().blocks.find(
      (entry) => entry.text === "Parrafo de apertura.",
    );
    expect(stylesMatch(paragraph?.style, styles.paragraph)).toBe(true);
  });

  it("aplica vineta con acento y numero de lista por separado", () => {
    const blocks = rendered().blocks;
    const bullet = blocks.find((entry) => entry.text === "\u2022");
    expect(includesStyle(bullet?.style, styles.marker)).toBe(true);
    expect(includesStyle(bullet?.style, styles.markerAccent)).toBe(true);

    const number = blocks.find((entry) => entry.text === "1.");
    expect(includesStyle(number?.style, styles.markerNumber)).toBe(true);
  });

  it("renderiza un separador por cada salto tematico", () => {
    const separators = rendered().blocks.filter((entry) =>
      stylesMatch(entry.style, styles.separator),
    );
    expect(separators).toHaveLength(1);
  });
});
