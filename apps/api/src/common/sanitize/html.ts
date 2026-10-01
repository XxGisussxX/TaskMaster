import { Logger } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitizado de HTML enriquecido en el servidor.
 *
 * El editor es TipTap y su salida se guarda cruda. Mientras el unico
 * sanitizador fuera `RichText` en el cliente, cualquier otra superficie que
 * leyera el mismo HTML —otro cliente, una exportacion, un email, un reporte—
 * recibiria el contenido sin filtrar, y el sanitizado del navegador tampoco
 * corre en un contexto sin DOM. Sanitizar antes de escribir deja la base limpia:
 * ahi ya no hay nada que sanitizar despues.
 *
 * La politica replica `apps/web/src/components/ui/rich-text.tsx` para que el
 * servidor sea tan estricto como el cliente y no haya un consumidor mas laxo
 * que el otro. Si se cambia uno, hay que cambiar el otro.
 */

/** Tags que sobreviven. Todo lo demas se desenvuelve o se descarta. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "a",
  "div",
  "label",
  "input",
  "span",
];

/**
 * Atributos permitidos por tag. El default de sanitize-html es permitir `style`
 * en cualquier elemento, que es justamente la via para `expression()` y para
 * `position:fixed` con `z-index` (clickjacking sobre la UI), asi que acá se
 * declara de forma explicita y `style` no aparece en ninguna parte.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  // `rel` y `target` los agrega `transformTags` abajo. Si no estan aca, el
  // filtro de atributos los borra despues de la transformacion.
  a: ["href", "target", "rel"],
  ul: ["data-type"],
  li: ["data-type", "data-checked"],
  input: ["type", "checked", "disabled"],
};

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  // Descomenta el tag pero conserva el texto: `<b>x</b>` -> `x`. Tirar el
  // contenido tambien seria defendible, pero un usuario que pega algo raro
  // pierde su nota entera sin aviso.
  disallowedTagsMode: "discard",
  // `escapeHtml` en entities unknown: sin esto `&colon;` puede volver a ser `:`
  // y armar un `javascript:` en un href que la lista de attrs ya dio por bueno.
  parser: {
    decodeEntities: true,
  },
  transformTags: {
    // El checkbox de TaskItem de TipTap es un input. Nos aseguramos de que solo
    // sea checkbox: cualquier otro input no aporta nada aqui y `type` lo elige
    // quien escribe.
    input: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, type: "checkbox", disabled: "" },
    }),
    // Los enlaces del editor abren en pestaña nueva; sin `rel` el destino
    // recibe `window.opener`.
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.href
        ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" }
        : attribs,
    }),
  },
};

const logger = new Logger("HtmlSanitizer");

/**
 * Límite defensivo. TipTap no produce nada cercano a esto; un payload de varios
 * MB se metería en un solo campo TEXT y volvería cada lectura cara.
 *
 * Se aplica al HTML de entrada. Lo que sale puede exceder el límite en unos
 * pocos caracteres porque el parser cierra los tags que quedaron abiertos al
 * truncar, así que el tamaño almacenado queda acotado por este valor más un
 * margen constante, no exactamente por él.
 */
export const MAX_HTML_LENGTH = 200_000;

/**
 * Devuelve el mismo valor de "ausencia" que recibe, porque el resultado se pasa
 * directo a un update de Prisma: `undefined` significa "no tocar el campo" y
 * `null` significa "vaciarlo". Convertir uno en otro hacia que un PATCH que no
 * manda el campo lo borrara igual.
 */
export function sanitizeRichText<T extends string | null | undefined>(
  html: T,
  field: string,
): T {
  if (html === null || html === undefined) return html;
  if (html === "") return html;

  const truncated = html.slice(0, MAX_HTML_LENGTH);
  if (truncated.length < html.length) {
    logger.warn(`HTML truncado a ${MAX_HTML_LENGTH} caracteres en ${field}`);
  }

  const clean = sanitizeHtml(truncated, OPTIONS);

  if (clean !== truncated) {
    // No se loguea el contenido: puede traer el payload que se acaba de quitar.
    const removed = truncated.length - clean.length;
    logger.warn(
      `HTML sanitizado en ${field} (${removed} caracteres distintos)`,
    );
  }

  return clean as T;
}
