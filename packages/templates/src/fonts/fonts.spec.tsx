import { describe, it, expect, beforeAll } from "vitest";
import {
  Document,
  Font,
  Page,
  Text,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  FONT_DATA_URL_PREFIX,
  FONT_FAMILY,
  registerDocumentFonts,
} from "./index";
import { INTER } from "./inter.data";
import { SOURCE_SERIF } from "./source-serif.data";
import { JETBRAINS_MONO } from "./jetbrains-mono.data";
import { embeddedFontNames, pdfText } from "../test/pdf-text";

const STYLES = [
  { fontWeight: 400, fontStyle: "normal" as const },
  { fontWeight: 700, fontStyle: "normal" as const },
  { fontWeight: 400, fontStyle: "italic" as const },
  { fontWeight: 700, fontStyle: "italic" as const },
];

const FAMILY_DATA: Record<string, Record<string, string>> = {
  [FONT_FAMILY.serif]: SOURCE_SERIF,
  [FONT_FAMILY.sans]: INTER,
  [FONT_FAMILY.mono]: JETBRAINS_MONO,
};

const FAMILY_PATTERNS: Record<string, RegExp> = {
  [FONT_FAMILY.serif]: /SourceSerif4/,
  [FONT_FAMILY.sans]: /Inter/,
  [FONT_FAMILY.mono]: /JetBrainsMono/,
};

const STYLE_KEYS = ["regular", "bold", "italic", "boldItalic"] as const;

const ROUNDTRIP_TEXT = (family: string, style: string) =>
  `${family}/${style} Café ñandú ¿Olé? «Sí»123`;

beforeAll(async () => {
  await registerDocumentFonts();
});

describe("fonts: registro", () => {
  it("es idempotente", () => {
    expect(registerDocumentFonts()).toBe(registerDocumentFonts());
  });

  it("resuelve cada estilo al fichero de fuente correcto", () => {
    for (const [family, data] of Object.entries(FAMILY_DATA)) {
      STYLES.forEach((style, index) => {
        const source = Font.getFont({ fontFamily: family, ...style });
        expect(source.src).toBe(
          FONT_DATA_URL_PREFIX + data[STYLE_KEYS[index]!],
        );
      });
    }
  });
});

describe("fonts: render", () => {
  it("renderiza y extrae roundtrip unicode en las 3 familias × 4 estilos", async () => {
    const lines: {
      family: string;
      style: string;
      weight: number;
      font: "normal" | "italic";
      text: string;
    }[] = [];
    for (const family of Object.keys(FAMILY_DATA)) {
      STYLES.forEach((style, index) => {
        const styleName = STYLE_KEYS[index] ?? "regular";
        lines.push({
          family,
          style: styleName,
          weight: style.fontWeight,
          font: style.fontStyle,
          text: ROUNDTRIP_TEXT(family, styleName),
        });
      });
    }

    const buffer = await renderToBuffer(
      <Document>
        <Page size="A4" style={{ padding: 20 }}>
          {lines.map((line, i) => (
            <Text
              key={i}
              style={{
                fontFamily: [line.family],
                fontWeight: line.weight,
                fontStyle: line.font,
                fontSize: 11,
              }}
            >
              {line.text}
            </Text>
          ))}
        </Page>
      </Document>,
    );

    const extracted = pdfText(buffer)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(extracted).toEqual(lines.map((l) => l.text));

    const names = embeddedFontNames(buffer).join(" ");
    for (const family of Object.keys(FAMILY_DATA)) {
      const count = embeddedFontNames(buffer).filter((n) =>
        FAMILY_PATTERNS[family]!.test(n),
      ).length;
      expect(count, `${family}: ${names}`).toBe(4);
    }
  });

  it("usa la cadena fontFamily como fallback por glifo", async () => {
    // ☐ (U+2610) solo existe en TaskSerif; la cadena sans→serif lo recupera.
    const buffer = await renderToBuffer(
      <Document>
        <Page size="A4" style={{ padding: 20 }}>
          <Text
            style={{
              fontFamily: [FONT_FAMILY.sans, FONT_FAMILY.serif],
              fontSize: 11,
            }}
          >
            A☐B
          </Text>
        </Page>
      </Document>,
    );
    expect(pdfText(buffer)).toContain("☐");
  });
});
