/**
 * Front-matter opcional al inicio del documento. Subconjunto YAML deliberadamente
 * mínimo: un bloque delimitado por `---` con líneas `clave: valor`. Los campos
 * de UI llegan en la Fase 5; aquí solo se leen del propio Markdown.
 */
export interface DocumentMetadata {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  from?: string;
  to?: string;
  subject?: string;
}

const KNOWN_KEYS = [
  "title",
  "subtitle",
  "author",
  "date",
  "from",
  "to",
  "subject",
] as const;

type KnownKey = (typeof KNOWN_KEYS)[number];

function isKnownKey(key: string): key is KnownKey {
  return (KNOWN_KEYS as readonly string[]).includes(key);
}

export function hasMetadata(data: DocumentMetadata): boolean {
  return Object.keys(data).length > 0;
}

/**
 * Separa el front-matter (si existe) del cuerpo del documento. Devuelve el
 * metadata y el cuerpo sin el bloque. Si no hay bloque inicial válido,
 * devuelve `{ data: {}, body: source }` sin modificar la fuente.
 */
export function parseFrontMatter(source: string): {
  data: DocumentMetadata;
  body: string;
} {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  if ((lines[0] ?? "").trim() !== "---") {
    return { data: {}, body: source };
  }

  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim() === "---") {
      end = index;
      break;
    }
  }
  if (end === -1) {
    return { data: {}, body: source };
  }

  const data: DocumentMetadata = {};
  for (let index = 1; index < end; index += 1) {
    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(
      (lines[index] ?? "").trim(),
    );
    if (!match) continue;
    const key = (match[1] ?? "").toLowerCase();
    let value = (match[2] ?? "").trim();
    value = value.replace(/^(["'])(.*)\1$/, "$2");
    if (isKnownKey(key) && value.length > 0) {
      data[key] = value;
    }
  }

  const body = lines
    .slice(end + 1)
    .join("\n")
    .replace(/^\n+/, "");

  return { data, body };
}
