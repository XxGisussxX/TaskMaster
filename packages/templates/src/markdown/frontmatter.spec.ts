import { describe, it, expect } from "vitest";
import { parseFrontMatter } from "./frontmatter";

describe("parseFrontMatter", () => {
  it("devuelve datos vacíos cuando no hay bloque inicial", () => {
    expect(parseFrontMatter("# Titulo\n\nCuerpo")).toEqual({
      data: {},
      body: "# Titulo\n\nCuerpo",
    });
  });

  it("separa el bloque y parsea las claves conocidas", () => {
    const source = [
      "---",
      "title: Informe anual",
      "subtitle: Ventas 2026",
      "author: Ana Perez",
      "date: 15/01/2026",
      "---",
      "# Contenido",
    ].join("\n");

    const { data, body } = parseFrontMatter(source);
    expect(data).toEqual({
      title: "Informe anual",
      subtitle: "Ventas 2026",
      author: "Ana Perez",
      date: "15/01/2026",
    });
    expect(body).toBe("# Contenido");
  });

  it("acepta comillas y normaliza CRLF", () => {
    const source = '---\r\ntitle: "Con comillas"\r\n---\r\nCuerpo';
    expect(parseFrontMatter(source).data.title).toBe("Con comillas");
  });

  it("ignora claves desconocidas y valores vacíos", () => {
    const source = ["---", "foo: bar", "author:", "to: Equipo"].join("\n");
    const { data } = parseFrontMatter(source + "\n---\nX");
    expect(data).toEqual({ to: "Equipo" });
  });

  it("no muta la fuente cuando el bloque no se cierra", () => {
    const source = "---\ntitle: X\n\nCuerpo";
    expect(parseFrontMatter(source)).toEqual({ data: {}, body: source });
  });
});
