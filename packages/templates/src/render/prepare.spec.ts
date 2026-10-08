import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../markdown";
import { prepareBlocks } from "./prepare";

const ALL = { numbering: true, dropCap: true, toc: true };

describe("prepareBlocks", () => {
  it("asigna anclas normalizadas y únicas a los titulares", () => {
    const model = parseMarkdown(
      ["# Introducción", "", "# Introducción", "", "Cuerpo."].join("\n"),
    );
    const { blocks } = prepareBlocks(model.blocks, ALL);
    const ids = blocks
      .filter((block) => block.type === "heading")
      .map((block) => (block.type === "heading" ? block.id : ""));
    expect(ids).toEqual(["introduccion", "introduccion-2"]);
  });

  it("numera secciones de forma jerárquica", () => {
    const model = parseMarkdown(
      [
        "# Uno",
        "",
        "## Uno A",
        "",
        "### Detalle",
        "",
        "## Uno B",
        "",
        "# Dos",
        "",
      ].join("\n"),
    );
    const { blocks } = prepareBlocks(model.blocks, ALL);
    const numbers = blocks
      .filter((block) => block.type === "heading")
      .map((block) => (block.type === "heading" ? block.number : undefined));
    expect(numbers).toEqual(["1", "1.1", undefined, "1.2", "2"]);
  });

  it("recopila H1/H2 en el índice con su numeración e ignora H3", () => {
    const model = parseMarkdown(
      ["# Uno", "", "## Uno A", "", "### Detalle", "", "## Uno B", ""].join(
        "\n",
      ),
    );
    const { toc } = prepareBlocks(model.blocks, ALL);
    expect(toc.map((entry) => [entry.level, entry.title])).toEqual([
      [1, "1. Uno"],
      [2, "1.1. Uno A"],
      [2, "1.2. Uno B"],
    ]);
    expect(toc[1]?.id).toBe("uno-a");
  });

  it("marca con capitular solo el primer párrafo", () => {
    const model = parseMarkdown(
      ["# Título", "", "Primer párrafo.", "", "Segundo párrafo."].join("\n"),
    );
    const { blocks } = prepareBlocks(model.blocks, ALL);
    const flags = blocks
      .filter((block) => block.type === "paragraph")
      .map((block) =>
        block.type === "paragraph" ? block.dropCap === true : false,
      );
    expect(flags).toEqual([true, false]);
  });

  it("no numera ni genera índice cuando el layout lo desactiva", () => {
    const model = parseMarkdown("# Uno\n\n## Uno A\n\nCuerpo.");
    const { blocks, toc } = prepareBlocks(model.blocks, {
      numbering: false,
      dropCap: false,
      toc: false,
    });
    expect(toc).toEqual([]);
    for (const block of blocks) {
      if (block.type === "heading") {
        expect(block.number).toBeUndefined();
      }
      if (block.type === "paragraph") {
        expect(block.dropCap).toBeUndefined();
      }
    }
  });
});
