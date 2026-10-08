import { describe, it, expect } from "vitest";
import { createDocumentTheme } from "../theme/tokens";
import { FONT_SIZE_SCALES, DEFAULT_ACCENT_COLOR } from "../theme";
import { createTemplateStyles } from "./styles";
import { CORPORATE_TEMPLATE, MINIMAL_TEMPLATE } from "./config";

const corporate = () => createDocumentTheme();

describe("createTemplateStyles", () => {
  describe("escalas tipograficas", () => {
    it("aplica la escala sm/lg a todos los cuerpos", () => {
      const sm = createTemplateStyles(
        createDocumentTheme({ fontSize: "sm" }),
        CORPORATE_TEMPLATE.layout,
      );
      const md = createTemplateStyles(corporate(), CORPORATE_TEMPLATE.layout);
      const lg = createTemplateStyles(
        createDocumentTheme({ fontSize: "lg" }),
        CORPORATE_TEMPLATE.layout,
      );

      const scale = (base: number, key: "sm" | "lg") =>
        Math.round(base * FONT_SIZE_SCALES[key] * 100) / 100;

      expect(sm.paragraph.fontSize).toBe(scale(10.5, "sm"));
      expect(md.paragraph.fontSize).toBe(10.5);
      expect(lg.paragraph.fontSize).toBe(scale(10.5, "lg"));
      expect(lg.h1.fontSize).toBe(scale(26, "lg"));
      expect(lg.h2.fontSize).toBe(scale(20.5, "lg"));
      expect(lg.cellText.fontSize).toBe(scale(9, "lg"));
      expect(lg.codeText.fontSize).toBe(scale(9, "lg"));
    });

    it("escala tambien el espaciado", () => {
      const lg = createTemplateStyles(
        createDocumentTheme({ fontSize: "lg" }),
        CORPORATE_TEMPLATE.layout,
      );
      expect(lg.paragraph.marginBottom).toBe(
        Math.round(8 * FONT_SIZE_SCALES.lg * 100) / 100,
      );
    });
  });

  describe("margenes de pagina", () => {
    it("narrow/normal/wide mapean a 80/104/128", () => {
      for (const [margin, expected] of [
        ["narrow", 80],
        ["normal", 104],
        ["wide", 128],
      ] as const) {
        const styles = createTemplateStyles(
          createDocumentTheme({ margin }),
          CORPORATE_TEMPLATE.layout,
        );
        expect(styles.page.paddingHorizontal).toBe(expected);
        expect(styles.page.paddingTop).toBe(expected);
        expect(styles.page.paddingBottom).toBe(expected + 16);
      }
    });
  });

  describe("color de acento", () => {
    it("usa el acento del tema en titulares, cabecera y barras", () => {
      const styles = createTemplateStyles(
        createDocumentTheme({ accentColor: "#b91c1c" }),
        CORPORATE_TEMPLATE.layout,
      );
      expect(styles.h1.color).toBe("#b91c1c");
      expect(styles.h2.color).toBe("#b91c1c");
      expect(styles.logo.backgroundColor).toBe("#b91c1c");
      expect(styles.headerTitle.color).toBe("#b91c1c");
      expect(styles.codeBlock.borderLeftColor).toBe("#b91c1c");
      expect(styles.quote.borderLeftColor).toBe("#b91c1c");
    });

    it("respeta el acento por defecto de cada plantilla", () => {
      expect(MINIMAL_TEMPLATE.defaultAccent).toBe("#111827");
      expect(CORPORATE_TEMPLATE.defaultAccent).toBe(DEFAULT_ACCENT_COLOR);
      expect(
        createTemplateStyles(
          createDocumentTheme({ accentColor: MINIMAL_TEMPLATE.defaultAccent }),
          MINIMAL_TEMPLATE.layout,
        ).h2.color,
      ).toBe("#111827");
    });
  });

  describe("diferencias de layout entre plantillas", () => {
    const minimal = createTemplateStyles(
      createDocumentTheme({ accentColor: MINIMAL_TEMPLATE.defaultAccent }),
      MINIMAL_TEMPLATE.layout,
    );
    const corporate = createTemplateStyles(
      createDocumentTheme({ accentColor: CORPORATE_TEMPLATE.defaultAccent }),
      CORPORATE_TEMPLATE.layout,
    );

    it("h1: minimal en color de texto con regla gris, corporate en acento con regla de acento", () => {
      expect(minimal.h1.color).toBe("#1a1a1a");
      expect(minimal.h1.borderBottomColor).toBe("#e5e7eb");
      expect(corporate.h1.color).toBe(DEFAULT_ACCENT_COLOR);
      expect(corporate.h1.borderBottomColor).toBe(DEFAULT_ACCENT_COLOR);
    });

    it("cabecera de tabla: corporate con relleno de acento, minimal sin relleno", () => {
      expect(corporate.rowHeader.backgroundColor).toBe(DEFAULT_ACCENT_COLOR);
      expect(minimal.rowHeader.backgroundColor).toBe("transparent");
    });

    it("zebra: solo corporate", () => {
      expect(MINIMAL_TEMPLATE.layout.tableZebra).toBe(false);
      expect(CORPORATE_TEMPLATE.layout.tableZebra).toBe(true);
      expect(corporate.rowZebra.backgroundColor).toBe("#f9fafb");
    });

    it("cita: corporate con fondo y barra de acento, minimal plano", () => {
      expect(corporate.quote.backgroundColor).toBe("#f9fafb");
      expect(corporate.quote.borderLeftColor).toBe(DEFAULT_ACCENT_COLOR);
      expect(minimal.quote.backgroundColor).toBeUndefined();
      expect(minimal.quote.borderLeftColor).toBe("#e5e7eb");
    });

    it("cabecera de pagina: monograma distinto por variante", () => {
      expect(corporate.logo.width).toBe(28);
      expect(minimal.logo.width).toBe(26);
      expect(corporate.header.borderBottomWidth).toBe(2);
      expect(minimal.header.borderBottomWidth).toBe(1);
    });

    it("ambas plantillas justifican solo cuando el layout lo permite (Fase 3: left)", () => {
      expect(minimal.paragraph.textAlign).toBe("left");
      expect(corporate.paragraph.textAlign).toBe("left");
      expect(MINIMAL_TEMPLATE.layout.paragraphAlign).toBe("left");
      expect(CORPORATE_TEMPLATE.layout.paragraphAlign).toBe("left");
    });
  });

  describe("cache", () => {
    it("devuelve la misma instancia para el mismo (theme, layout)", () => {
      const a = createTemplateStyles(corporate(), CORPORATE_TEMPLATE.layout);
      const b = createTemplateStyles(corporate(), CORPORATE_TEMPLATE.layout);
      expect(a).toBe(b);
    });

    it("devuelve instancias distintas para layouts distintos", () => {
      const a = createTemplateStyles(corporate(), CORPORATE_TEMPLATE.layout);
      const b = createTemplateStyles(corporate(), MINIMAL_TEMPLATE.layout);
      expect(a).not.toBe(b);
    });

    it("devuelve instancias distintas para temas distintos", () => {
      const a = createTemplateStyles(corporate(), CORPORATE_TEMPLATE.layout);
      const b = createTemplateStyles(
        createDocumentTheme({ accentColor: "#b91c1c" }),
        CORPORATE_TEMPLATE.layout,
      );
      expect(a).not.toBe(b);
      expect(b.h2.color).toBe("#b91c1c");
    });
  });
});
