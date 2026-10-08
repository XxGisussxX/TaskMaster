import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectMarkdown, parsePlainText } from "./normalize";
import type { Block, DocumentModel } from "./model";
import { parseMarkdown } from "./parse";

function load(name: string): string {
  return readFileSync(
    new URL(`../__fixtures__/plain/${name}.md`, import.meta.url),
    "utf8",
  );
}

function headingsOf(model: DocumentModel): { level: number; text: string }[] {
  return model.blocks
    .filter(
      (b): b is Extract<Block, { type: "heading" }> => b.type === "heading",
    )
    .map((b) => ({
      level: b.level,
      text: b.children.find((c) => c.type === "text")?.value ?? "",
    }));
}

const text = (b: Block): string =>
  b.type === "paragraph"
    ? b.children.map((c) => (c.type === "text" ? c.value : "")).join("|")
    : "";

describe("parsePlainText heuristics", () => {
  it("parses fixtures deterministically", () => {
    for (const name of [
      "carta",
      "resultados-temporada",
      "edge-vacio",
      "edge-tildes-listas",
    ]) {
      expect(parsePlainText(load(name))).toMatchSnapshot(name);
    }
  });

  it("does NOT turn greeting, sign-off or signature into H2 (audit regression)", () => {
    const model = parsePlainText(load("carta"));
    const headings = headingsOf(model);
    expect(headings.map((h) => h.text)).toEqual([
      "RESULTADOS DE LA TEMPORADA",
      "Clasificacion final",
    ]);
    expect(
      model.blocks.some(
        (b) => b.type === "heading" && text(b).startsWith("Querida"),
      ),
    ).toBe(false);
    expect(
      model.blocks.some(
        (b) => b.type === "heading" && text(b).includes("Juan Perez"),
      ),
    ).toBe(false);
    // Greetings survive as a paragraph.
    const first = model.blocks[0];
    expect(
      first?.type === "paragraph" && text(first).startsWith("Querida Maria,"),
    ).toBe(true);
  });

  it("does NOT treat a title glued to a list as H2 (blank-line rule)", () => {
    const model = parsePlainText(load("carta"));
    expect(
      headingsOf(model).find((h) => h.text === "Inscripcion y requisitos"),
    ).toBeUndefined();
    const paragraph = model.blocks.find(
      (b) =>
        b.type === "paragraph" && text(b).includes("Inscripcion y requisitos"),
    );
    expect(paragraph).toBeDefined();
  });

  it("detects a table header row (not as heading) and table rows", () => {
    const model = parsePlainText(load("resultados-temporada"));
    const table = model.blocks.find((b) => b.type === "table") as Extract<
      Block,
      { type: "table" }
    >;
    expect(table.header.cells.map((c) => c.inlines)).toEqual([
      [{ type: "text", value: "Equipo" }],
      [{ type: "text", value: "Puntos" }],
      [{ type: "text", value: "Goles" }],
    ]);
    expect(table.rows).toHaveLength(3);
  });

  it("keeps real H2 candidates when surrounded by blank lines and followed by a list", () => {
    const model = parsePlainText(load("resultados-temporada"));
    const headings = headingsOf(model);
    expect(headings).toContainEqual({
      level: 2,
      text: "Detalle de la fase final",
    });
    expect(headings).toContainEqual({
      level: 2,
      text: "Marcadores de la fecha 20",
    });
    expect(headings).toContainEqual({
      level: 2,
      text: "Observaciones generales",
    });
  });

  it("orders numeric lists by the first number", () => {
    const model = parsePlainText(load("resultados-temporada"));
    const lists = model.blocks.filter((b) => b.type === "list");
    const ordered = lists.find(
      (b): b is Extract<Block, { type: "list" }> => b.ordered,
    );
    expect(ordered?.start).toBe(1);
    expect(ordered?.items).toHaveLength(3);
  });

  it("treats a title followed directly by a list as too loose for H2", () => {
    const model = parsePlainText(
      "Seccion sin espacio\n- item uno\n- item dos\n",
    );
    expect(
      headingsOf(model).find((h) => h.text === "Seccion sin espacio"),
    ).toBeUndefined();
    const first = model.blocks[0];
    expect(first?.type).toBe("paragraph");
  });

  it("parses fenced code, blockquotes and thematic breaks", () => {
    const source =
      "```ts\nconst x = 1;\n```\n\n> cita\n\n---\n\nUltimo parrafo.\n";
    const model = parsePlainText(source);
    expect(model.blocks.map((b) => b.type)).toEqual([
      "code",
      "blockquote",
      "thematicBreak",
      "paragraph",
    ]);
    const code = model.blocks[0] as Extract<Block, { type: "code" }>;
    expect(code.lang).toBe("ts");
    expect(code.value).toBe("const x = 1;");
  });

  it("handles task checkboxes in plain lists", () => {
    const model = parsePlainText("- [x] hecho\n- [ ] pendiente\n");
    const list = model.blocks[0] as Extract<Block, { type: "list" }>;
    expect(list.items.map((i) => i.checked)).toEqual([true, false]);
  });

  it("contains the whole text of a paragraph including emoji", () => {
    const model = parsePlainText(load("edge-tildes-listas"));
    expect(model.blocks[0]?.type).toBe("paragraph");
    const target = model.blocks.find(
      (b) => b.type === "paragraph" && text(b).includes("apóstrofos correctos"),
    );
    expect(target).toBeDefined();
  });

  it("produces no blocks for empty content", () => {
    expect(parsePlainText("").blocks).toEqual([]);
    expect(parsePlainText("   \n\n  \n").blocks).toEqual([]);
  });

  it("strips a leading BOM and handles CRLF", () => {
    const model = parsePlainText("\uFEFFTÍTULO DE PRUEBA\r\n\r\nPárrafo.\r\n");
    expect(headingsOf(model).map((h) => h.text)).toEqual(["TÍTULO DE PRUEBA"]);
  });
});

describe("detectMarkdown + auto mode", () => {
  it("flags markdown syntax and plain text accordingly", () => {
    expect(detectMarkdown("# Título\n\nTexto con **negrita**.\n")).toBe(true);
    expect(detectMarkdown(load("carta"))).toBe(false);
  });

  it("resolves auto mode towards markdown when syntax is present", () => {
    const model = parseMarkdown(
      "## Sección\n\nTexto con **negrita**.\n",
      "auto",
    );
    expect(model.blocks[0]?.type).toBe("heading");
  });
});
