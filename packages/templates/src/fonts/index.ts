import { Font } from "@react-pdf/renderer";
import { INTER } from "./inter.data";
import { SOURCE_SERIF } from "./source-serif.data";
import { JETBRAINS_MONO } from "./jetbrains-mono.data";

/**
 * Nombres semánticos de familia. El tema y las plantillas referencian estas
 * constantes; la asignación concreta a un fichero de fuente vive en
 * registerDocumentFonts(). Los ficheros .data.ts se importan de forma
 * estática: los datos deben estar registrados de forma síncrona ANTES de que
 * react-pdf componga el documento (la API invoca las plantillas como
 * funciones puras sin hooks ni awaits). Contrapartida: los ~4 MB de base64
 * viajan en el chunk de templates; si el bundle pesa demasiado, la Fase 5
 * puede moverlos a una carga diferida a nivel de ruta con bloqueo de render.
 */
export const FONT_FAMILY = {
  serif: "TaskSerif",
  sans: "TaskSans",
  mono: "TaskMono",
} as const;

/**
 * Cadenas de fallback: react-pdf resuelve el glifo por glifo dentro de la
 * cadena, por lo que un carácter presente solo en una familia se renderiza
 * igual (p. ej. ☐ existe en TaskSerif pero no en TaskSans).
 */
export const FONT_CHAINS: {
  body: string[];
  heading: string[];
  mono: string[];
} = {
  body: [FONT_FAMILY.serif, FONT_FAMILY.sans, FONT_FAMILY.mono],
  heading: [FONT_FAMILY.sans, FONT_FAMILY.serif, FONT_FAMILY.mono],
  mono: [FONT_FAMILY.mono, FONT_FAMILY.sans, FONT_FAMILY.serif],
};

export const FONT_DATA_URL_PREFIX = "data:font/ttf;base64,";

type FontStyleKey = "regular" | "bold" | "italic" | "boldItalic";

type FontStyles = Record<FontStyleKey, string>;

let registration: Promise<void> | null = null;

/**
 * Registra las tres familias (4 estilos cada una, TTF/OTF embebidos como data
 * URL) en el store global de react-pdf. Idempotente: las llamadas posteriores
 * reutilizan la misma promesa. El cuerpo es síncrono (los datos ya están en
 * el módulo), de modo que una llamada desde el cuerpo de un componente deja
 * las familias registradas antes de que react-pdf componga la página.
 */
export function registerDocumentFonts(): Promise<void> {
  registration ??= loadAndRegister();
  return registration;
}

async function loadAndRegister(): Promise<void> {
  registerFamily(FONT_FAMILY.sans, INTER);
  registerFamily(FONT_FAMILY.serif, SOURCE_SERIF);
  registerFamily(FONT_FAMILY.mono, JETBRAINS_MONO);
}

function registerFamily(family: string, styles: FontStyles): void {
  Font.register({
    family,
    fonts: [
      { src: toDataUrl(styles.regular), fontWeight: 400, fontStyle: "normal" },
      { src: toDataUrl(styles.bold), fontWeight: 700, fontStyle: "normal" },
      { src: toDataUrl(styles.italic), fontWeight: 400, fontStyle: "italic" },
      {
        src: toDataUrl(styles.boldItalic),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });
}

function toDataUrl(base64: string): string {
  return `${FONT_DATA_URL_PREFIX}${base64}`;
}

/**
 * react-pdf memoiza el objeto `fontkit.Font` en `FontSource.data` y lo
 * reutiliza entre documentos del mismo proceso. Su caché interna `_glyphs`
 * (clave: id de glifo) devuelve, a partir del segundo documento, glifos a los
 * que les falta `codePoints`, corrompiendo el CMap `ToUnicode` del PDF: el
 * dibujo es correcto pero copiar/pegar y extraer texto fallan
 * (react-pdf #2408/#2488, fontkit `getGlyph`). Vaciar la caché antes de
 * componer el documento obliga a re-resolver los glifos con sus codePoints.
 */
export function resetDocumentFontGlyphCaches(): void {
  const families = Font.getRegisteredFonts() as unknown as Record<
    string,
    { sources?: { data?: { _glyphs?: unknown } | null }[] }
  >;

  for (const family of Object.values(families)) {
    for (const source of family?.sources ?? []) {
      if (source?.data && "_glyphs" in source.data) {
        source.data._glyphs = {};
      }
    }
  }
}
