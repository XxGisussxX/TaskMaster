import { Font } from "@react-pdf/renderer";

/**
 * Nombres semánticos de familia. El tema y las plantillas referencian estas
 * constantes; la asignación concreta a un fichero de fuente vive en
 * registerDocumentFonts() (los ficheros .data.ts se cargan bajo demanda para
 * no cargar ~4 MB de base64 en el bundle hasta que se renderiza un PDF).
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
 * reutilizan la misma promesa.
 */
export function registerDocumentFonts(): Promise<void> {
  registration ??= loadAndRegister();
  return registration;
}

async function loadAndRegister(): Promise<void> {
  const [{ INTER }, { SOURCE_SERIF }, { JETBRAINS_MONO }] = await Promise.all([
    import("./inter.data"),
    import("./source-serif.data"),
    import("./jetbrains-mono.data"),
  ]);
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
