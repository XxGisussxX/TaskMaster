import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";
import type { Block, DocumentModel } from "./model";

const FIXTURES = [
  "informe-ventas",
  "proyecto",
  "edge-emoji",
  "edge-nested-table",
];

function load(name: string): string {
  return readFileSync(
    new URL(`../__fixtures__/markdown/${name}.md`, import.meta.url),
    "utf8",
  );
}

function findById(model: DocumentModel, id: string): Block | undefined {
  return model.blocks.find(
    (block) => block.type === "heading" && block.id === id,
  );
}

describe("parseMarkdown (mode: markdown)", () => {
  it.each(FIXTURES)("parses %s deterministically", (name) => {
    expect(parseMarkdown(load(name))).toMatchSnapshot();
  });

  it("keeps inline emphasis and links inside paragraphs", () => {
    const model = parseMarkdown(load("informe-ventas"));
    const paragraph = model.blocks.find(
      (b) =>
        b.type === "paragraph" && b.children.some((c) => c.type === "bold"),
    );
    expect(paragraph?.type).toBe("paragraph");
    const bold = (
      paragraph as Extract<Block, { type: "paragraph" }> | undefined
    )?.children.find((c) => c.type === "bold");
    expect(bold && "children" in bold ? bold.children : undefined).toEqual([
      { type: "text", value: "12%" },
    ]);
  });

  it("maps gfm tables with per-column alignment", () => {
    const model = parseMarkdown(load("informe-ventas"));
    const table = model.blocks.find((b) => b.type === "table") as Extract<
      Block,
      { type: "table" }
    >;
    expect(table.align).toEqual(["left", "center", "right"]);
    expect(table.header.cells.map((c) => c.inlines)).toEqual([
      [{ type: "text", value: "Canal" }],
      [{ type: "text", value: "Trimestre" }],
      [{ type: "text", value: "Var." }],
    ]);
    expect(table.rows).toHaveLength(3);
  });

  it("supports task lists, blockquotes, code blocks and thematic breaks", () => {
    const model = parseMarkdown(load("informe-ventas"));
    const list = model.blocks.find(
      (b) =>
        b.type === "list" && b.items.some((i) => "checked" in i && i.checked),
    ) as Extract<Block, { type: "list" }>;
    expect(list.items.map((i) => i.checked)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(model.blocks.some((b) => b.type === "blockquote")).toBe(true);
    const code = model.blocks.find((b) => b.type === "code") as Extract<
      Block,
      { type: "code" }
    >;
    expect(code.lang).toBe("ts");
    expect(code.value).toContain("store.ventas");
    expect(model.blocks.some((b) => b.type === "thematicBreak")).toBe(true);
  });

  it("derives stable heading ids and a document title", () => {
    const model = parseMarkdown(load("proyecto"));
    expect(model.title).toBe("Proyecto Alma");
    const modulo = findById(model, "modulos") as Extract<
      Block,
      { type: "heading" }
    >;
    expect(modulo.type).toBe("heading");
    expect(modulo.level).toBe(3);
    expect(findById(model, "autenticacion")?.type).toBe("heading");
  });

  it("supports heading depth up to 4", () => {
    const model = parseMarkdown(load("proyecto"));
    const autenticacion = model.blocks.find(
      (b) => b.type === "heading" && b.id === "autenticacion",
    ) as Extract<Block, { type: "heading" }>;
    expect(autenticacion.level).toBe(4);
  });

  it("resolves reference-style links", () => {
    const model = parseMarkdown(load("proyecto"));
    const paragraph = model.blocks.find(
      (b) =>
        b.type === "paragraph" && b.children.some((c) => c.type === "link"),
    ) as Extract<Block, { type: "paragraph" }>;
    const link = paragraph.children.find((c) => c.type === "link");
    expect(link).toEqual({
      type: "link",
      url: "https://example.com/diccionario",
      children: [{ type: "text", value: "ref" }],
    });
  });

  it("preserves emoji content and task checks", () => {
    const model = parseMarkdown(load("edge-emoji"));
    const heading = model.blocks.find((b) => b.type === "heading") as Extract<
      Block,
      { type: "heading" }
    >;
    expect(heading.children).toEqual([
      { type: "text", value: "🏆 Informe anual 🏆" },
    ]);
    const list = model.blocks.find((b) => b.type === "list") as Extract<
      Block,
      { type: "list" }
    >;
    expect(list.items.map((i) => i.checked)).toEqual([undefined, true, false]);
  });

  it("keeps nested lists deep and tables with empty cells", () => {
    const model = parseMarkdown(load("edge-nested-table"));
    const rootList = model.blocks.find((b) => b.type === "list") as Extract<
      Block,
      { type: "list" }
    >;

    const raiz = rootList.items[0]!;
    expect(raiz.children[0]!.type).toBe("paragraph");
    const rama1 = raiz.children.find((c) => c.type === "list") as Extract<
      Block,
      { type: "list" }
    >;
    expect(rama1.items).toHaveLength(2);

    const raiz2 = rootList.items[1]!;
    const rama3 = raiz2.children.find((c) => c.type === "list") as Extract<
      Block,
      { type: "list" }
    >;
    const hojaList = rama3.items[0]!.children.find(
      (c) => c.type === "list",
    ) as Extract<Block, { type: "list" }>;
    const deepList = hojaList.items[0]!.children.find(
      (c) => c.type === "list",
    ) as Extract<Block, { type: "list" }>;
    expect(deepList).toBeDefined();
    expect(
      deepList!.items[0]!.children.filter((c) => c.type === "list"),
    ).toHaveLength(0);

    const table = model.blocks.find((b) => b.type === "table") as Extract<
      Block,
      { type: "table" }
    >;
    expect(
      table.rows.map((r) =>
        r.cells.map((c) =>
          c.inlines.length === 0
            ? ""
            : (c.inlines[0] as { value: string }).value,
        ),
      ),
    ).toEqual([
      ["Energía", "3", "5", "", "2"],
      ["Logística", "1", "", "4", "3"],
      ["Finanzas", "", "2", "", ""],
    ]);
  });

  it("empty input yields an empty model", () => {
    const model = parseMarkdown("");
    expect(model.blocks).toEqual([]);
    expect(model.title).toBeUndefined();
  });

  it("does not treat table cells or signature-ish lines as headings in plain mode", () => {
    const model = parseMarkdown("Querida Maria,\n\nTexto.\n", "plain");
    expect(model.blocks[0]?.type).not.toBe("heading");
  });
});
