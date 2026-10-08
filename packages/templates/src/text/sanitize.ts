import { SUPPORTED_CODEPOINTS } from "./supported.data";

/**
 * Política de glifos del motor de documentos (Fase 2):
 *
 * - Las fuentes embebidas (Inter, Source Serif 4, JetBrains Mono) cubren
 *   latín, griego, cirílico, puntuación, flechas, matemáticas y símbolos
 *   básicos (✓ ✗ ☐ ★…). La cobertura exacta está generada en
 *   supported.data.ts a partir de las tablas cmap de los 12 ficheros.
 * - Los emojis y cualquier carácter sin glifo (p. ej. ✔, la mayoría de los
 *   dingbats, astral emoji) se OMITEN al renderizar: react-pdf los dibuja
 *   como residuos (.notdef/códigos de control) que ensucian el PDF. El
 *   editor y la vista previa HTML sí los muestran; solo el PDF los omite.
 * - U+200D (ZWJ) y U+FE0F (VS16) no tienen glifo y se caen solos, por lo
 *   que las secuencias emoji complejas desaparecen completas.
 * - El texto se valida por code point tras un préproceso: \r\n → \n,
 *   \t → espacio (las fuentes no tienen glifo de tabulador) y el resto de
 *   controles C0/DEL se descartan.
 */

function isSupported(cp: number): boolean {
  let lo = 0;
  let hi = SUPPORTED_CODEPOINTS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = SUPPORTED_CODEPOINTS[mid];
    if (range === undefined) return false;
    if (cp < range[0]) hi = mid - 1;
    else if (cp > range[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

export function stripUnsupportedText(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const cp = input.codePointAt(i);
    if (cp === undefined) break;
    const size = cp > 0xffff ? 2 : 1;
    if (cp === 0x0a) {
      out += "\n";
    } else if (cp === 0x0d) {
      out += "\n";
      if (input.charCodeAt(i + 1) === 0x0a) i += 1;
    } else if (cp === 0x09) {
      out += " ";
    } else if (cp >= 0x20 && cp !== 0x7f && isSupported(cp)) {
      out += input.slice(i, i + size);
    }
    i += size;
  }
  return out;
}
