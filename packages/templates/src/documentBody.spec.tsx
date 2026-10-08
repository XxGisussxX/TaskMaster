import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import { DocumentBody, groupSections } from "./DocumentBody";
import { parseMarkdown } from "./parser";
import { resolveStyles as minimalStyles } from "./templates/MinimalTemplate";
import type { PdfStyle } from "./pdf-style";

const CONTENT = [
  "REPORTE DE VENTAS",
  "",
  "Resumen Ejecutivo",
  "",
  "Parrafo de apertura.",
  "",
  "- Metricas usadas",
  "",
  "OTRA SECCION",
  "",
  "1. Introduccion",
].join("\n");

interface TextBlock {
  text: string;
  style: PdfStyle;
}

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }

  return "";
}

function asArray(node: ReactNode): ReactNode[] {
  return Array.isArray(node) ? node : [node];
}

function hasElementChild(children: ReactNode[]): boolean {
  return children.some((child) =>
    Array.isArray(child) ? hasElementChild(child) : isValidElement(child),
  );
}

function textBlocks(node: ReactNode, blocks: TextBlock[] = []): TextBlock[] {
  for (const child of asArray(node)) {
    if (Array.isArray(child)) {
      textBlocks(child, blocks);
      continue;
    }

    if (!isValidElement(child)) {
      continue;
    }

    const props = child.props as { children?: ReactNode; style?: PdfStyle };
    const children = asArray(props.children);

    if (!hasElementChild(children)) {
      if (props.style !== undefined) {
        blocks.push({ text: flattenText(props.children), style: props.style });
      }
      continue;
    }

    for (const grandChild of children) {
      if (Array.isArray(grandChild) || isValidElement(grandChild)) {
        textBlocks(grandChild, blocks);
        continue;
      }

      if (typeof grandChild === "string" || typeof grandChild === "number") {
        blocks.push({ text: String(grandChild), style: props.style ?? {} });
      }
    }
  }

  return blocks;
}

const styles = minimalStyles();

function blocks() {
  return textBlocks(
    DocumentBody({
      sections: parseMarkdown(CONTENT, { subheadings: true }),
      styles,
    }),
  );
}

describe("groupSections", () => {
  it("inicia un bloque nuevo en cada titulo", () => {
    const grouped = groupSections(
      parseMarkdown(CONTENT, { subheadings: true }),
    );

    expect(grouped).toHaveLength(3);
    expect(grouped[0]?.sections[0]).toMatchObject({ type: "heading" });
    expect(grouped[1]?.sections[0]).toMatchObject({ type: "heading-2" });
    expect(grouped[2]?.sections[0]).toMatchObject({ type: "heading" });
  });

  it("agrupa el contenido que sigue a un titulo", () => {
    const grouped = groupSections(
      parseMarkdown(CONTENT, { subheadings: true }),
    );

    expect(grouped[1]?.sections.map((section) => section.type)).toEqual([
      "heading-2",
      "paragraph",
      "list-item",
    ]);
  });

  it("devuelve bloques vacios para contenido vacio", () => {
    expect(groupSections([])).toEqual([]);
  });
});

describe("DocumentBody", () => {
  it("renderiza un elemento por seccion en orden", () => {
    expect(blocks().map((block) => block.text)).toEqual([
      "REPORTE DE VENTAS",
      "",
      "Resumen Ejecutivo",
      "Parrafo de apertura.",
      "\u2022 ",
      "Metricas usadas",
      "",
      "OTRA SECCION",
      "1.  ",
      "Introduccion",
    ]);
  });

  it("aplica el estilo de h1 a los titulos en mayusculas", () => {
    expect(
      blocks().find((block) => block.text === "REPORTE DE VENTAS")?.style,
    ).toBe(styles.h1);
  });

  it("aplica el estilo de h2 a los subtitulos", () => {
    expect(
      blocks().find((block) => block.text === "Resumen Ejecutivo")?.style,
    ).toBe(styles.h2);
  });

  it("aplica el estilo de vineta y de item por separado", () => {
    const rendered = blocks();

    expect(rendered.find((block) => block.text === "\u2022 ")?.style).toBe(
      styles.marker,
    );
    expect(
      rendered.find((block) => block.text === "Metricas usadas")?.style,
    ).toBe(styles.list);
  });

  it("aplica el estilo de parrafo", () => {
    expect(
      blocks().find((block) => block.text === "Parrafo de apertura.")?.style,
    ).toBe(styles.paragraph);
  });

  it("separa el numero del texto en las listas numeradas", () => {
    const rendered = blocks();
    const number = rendered.find((block) => block.text.startsWith("1."));

    expect(number?.text).toBe("1.  ");
    expect(number?.style).toBe(styles.number);
  });

  it("renderiza un separador entre bloques grandes", () => {
    const separators = blocks().filter(
      (block) => block.style === styles.separator,
    );

    expect(separators).toHaveLength(2);
  });

  it("no renderiza nada cuando no hay secciones", () => {
    expect(textBlocks(DocumentBody({ sections: [], styles }))).toEqual([]);
  });
});
