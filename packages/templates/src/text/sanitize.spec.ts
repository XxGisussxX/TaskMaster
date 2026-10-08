import { describe, it, expect } from "vitest";
import { stripUnsupportedText } from "./sanitize";

describe("stripUnsupportedText", () => {
  it("deja intacto el texto con cobertura garantizada", () => {
    const input = "Café ñandú ¿Qué tal? «Sí» — … ✓ ☐ ★ → ∑≈ ·§";
    expect(stripUnsupportedText(input)).toBe(input);
  });

  it("omite emojis astral y dingbats sin glifo", () => {
    expect(stripUnsupportedText("Lanza 🚀 el deploy ✅")).toBe(
      "Lanza  el deploy ",
    );
    expect(stripUnsupportedText("a✔b")).toBe("ab");
  });

  it("elimina ZWJ y VS16, por lo que las secuencias emoji desaparecen completas", () => {
    expect(stripUnsupportedText("👨‍👩‍👧")).toBe("");
    // ⚠ (U+26A0) sí tiene glifo; el selector VS16 se cae solo.
    expect(stripUnsupportedText("⚠️")).toBe("⚠");
  });

  it("normaliza retornos de carro y convierte tabuladores en espacios", () => {
    expect(stripUnsupportedText("a\r\nb\rc")).toBe("a\nb\nc");
    expect(stripUnsupportedText("a\tb")).toBe("a b");
  });

  it("descarta controles C0 y DEL", () => {
    expect(stripUnsupportedText("a\u0000\u0001\u001fb\u007f")).toBe("ab");
  });

  it("conserva marcas combinantes (texto descompuesto)", () => {
    expect(stripUnsupportedText("e\u0301")).toBe("e\u0301");
  });

  it("descarta surrogates sueltos y code points astrales no cubiertos", () => {
    expect(stripUnsupportedText("\ud83d")).toBe("");
    expect(stripUnsupportedText("\u10d0")).toBe("");
  });

  it("convierte cadenas vacías y cadenas totalmente no soportadas en vacío", () => {
    expect(stripUnsupportedText("")).toBe("");
    expect(stripUnsupportedText("🚀🔥💡")).toBe("");
  });
});
