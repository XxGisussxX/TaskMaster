import { inflateSync } from "node:zlib";

const CP1252_HIGH: Record<number, string> = {
  0x80: "\u20ac",
  0x82: "\u201a",
  0x83: "\u0192",
  0x84: "\u201e",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02c6",
  0x89: "\u2030",
  0x8a: "\u0160",
  0x8b: "\u2039",
  0x8c: "\u0152",
  0x8e: "\u017d",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201c",
  0x94: "\u201d",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02dc",
  0x99: "\u2122",
  0x9a: "\u0161",
  0x9b: "\u203a",
  0x9c: "\u0153",
  0x9e: "\u017e",
  0x9f: "\u0178",
};

function winAnsiByte(byte: number): string {
  return byte >= 0x80
    ? (CP1252_HIGH[byte] ?? String.fromCharCode(byte))
    : String.fromCharCode(byte);
}

function winAnsi(buf: Buffer): string {
  let out = "";
  for (const byte of buf) out += winAnsiByte(byte);
  return out;
}

function utf16be(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 3 < clean.length; i += 4) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
  }
  return out;
}

function inflate(buf: Buffer): Buffer {
  try {
    return inflateSync(buf);
  } catch {
    return buf;
  }
}

type Cmap = Map<number, string> | null;

/**
 * Extrae el texto visible de un PDF generado por @react-pdf/renderer.
 * Decodifica ToUnicode CMap (bfchar y bfrange, formas array y triple) y, para
 * fuentes estándar sin ToUnicode, bytes WinAnsi. Cada operación de show de
 * texto termina una línea; los fragmentos inline (fallback de fuente) van sin
 * salto, igual que en el PDF.
 */
export function pdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const objs = new Map<number, string>();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) {
    objs.set(Number(m[1]), m[2] ?? "");
  }
  const body = (n: number): string => objs.get(n) ?? "";
  const streamOf = (n: number): string | null => {
    const m = body(n).match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (!m || m[1] === undefined) return null;
    return inflate(Buffer.from(m[1], "latin1")).toString("latin1");
  };

  const cmapCache = new Map<number, Cmap>();
  const cmapForFont = (fontObjNum: number | undefined): Cmap => {
    if (fontObjNum === undefined) return null;
    const cached = cmapCache.get(fontObjNum);
    if (cached !== undefined) return cached;
    const m = body(fontObjNum).match(/\/ToUnicode (\d+) 0 R/);
    let map: Cmap = null;
    if (m && m[1] !== undefined) {
      const text = streamOf(Number(m[1])) ?? "";
      map = new Map();
      for (const blk of text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
        for (const mm of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([^>]+)>/g)) {
          if (mm[1] !== undefined && mm[2] !== undefined) {
            map.set(parseInt(mm[1], 16), utf16be(mm[2]));
          }
        }
      }
      for (let blk of text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
        blk = blk.replace(
          /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g,
          (_full, a: string, b: string, list: string) => {
            const lo = parseInt(a, 16);
            const hi = parseInt(b, 16);
            const dsts = [...list.matchAll(/<([^>]+)>/g)].map((d) =>
              utf16be(d[1] ?? ""),
            );
            for (let g = lo; g <= hi && g - lo < dsts.length; g++) {
              map!.set(g, dsts[g - lo] ?? "");
            }
            return "";
          },
        );
        for (const mm of blk.matchAll(
          /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([^>]+)>/g,
        )) {
          if (mm[1] === undefined || mm[2] === undefined || mm[3] === undefined)
            continue;
          const lo = parseInt(mm[1], 16);
          const hi = parseInt(mm[2], 16);
          const dst = parseInt(mm[3], 16);
          for (let g = lo; g <= hi; g++)
            map.set(g, String.fromCharCode(dst + (g - lo)));
        }
      }
    }
    cmapCache.set(fontObjNum, map);
    return map;
  };

  const decodeShow = (hex: string, cmap: Cmap): string => {
    let out = "";
    if (cmap) {
      for (let i = 0; i + 3 < hex.length; i += 4) {
        out += cmap.get(parseInt(hex.slice(i, i + 4), 16)) ?? "";
      }
    } else {
      for (let i = 0; i + 1 < hex.length; i += 2) {
        out += winAnsiByte(parseInt(hex.slice(i, i + 2), 16));
      }
    }
    return out;
  };

  const pages: string[] = [];
  for (const [, pageBody] of objs) {
    if (!/\/Type\s*\/Page[^s]/.test(pageBody)) continue;
    const resRef = pageBody.match(/\/Resources\s*(\d+) 0 R/);
    const resources =
      resRef && resRef[1] !== undefined ? body(Number(resRef[1])) : pageBody;
    const fontMap = new Map<string, number>();
    const fontSec = resources.match(/\/Font\s*<<(.*?)>>/s);
    if (fontSec && fontSec[1] !== undefined) {
      for (const fm of fontSec[1].matchAll(/\/(\S+)\s+(\d+) 0 R/g)) {
        if (fm[1] !== undefined && fm[2] !== undefined)
          fontMap.set(fm[1], Number(fm[2]));
      }
    }

    const contents: number[] = [];
    const arr = pageBody.match(/\/Contents\s*\[(.*?)\]/s);
    const single = pageBody.match(/\/Contents\s+(\d+) 0 R/);
    if (arr && arr[1] !== undefined) {
      for (const c of arr[1].matchAll(/(\d+) 0 R/g)) {
        if (c[1] !== undefined) contents.push(Number(c[1]));
      }
    } else if (single && single[1] !== undefined) {
      contents.push(Number(single[1]));
    }

    let text = "";
    let current: Cmap = null;
    for (const c of contents) {
      const s = streamOf(c);
      if (!s) continue;
      const re =
        /\/(\S+)\s+[\d.]+\s+Tf|\[((?:[^\]])*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj|\(([^)]*)\)\s*Tj|(T\*)|(-?[\d.]+)\s+(-?[\d.]+)\s+Td/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        if (m[1] !== undefined) current = cmapForFont(fontMap.get(m[1]));
        else if (m[2] !== undefined) {
          for (const hm of m[2].matchAll(/<([^>]+)>/g))
            text += decodeShow(hm[1] ?? "", current);
          text += "\n";
        } else if (m[3] !== undefined) {
          text += decodeShow(m[3], current);
          text += "\n";
        } else if (m[4] !== undefined) {
          text += winAnsi(Buffer.from(m[4], "latin1"));
          text += "\n";
        } else if (m[5] !== undefined) text += "\n";
        else if (m[6] !== undefined && m[7] !== undefined && Number(m[7]) !== 0)
          text += "\n";
      }
    }
    pages.push(text);
  }
  return pages.join("\n");
}

/** Nombres BaseFont embebidos (con subconjunto) en el PDF, sin duplicados. */
export function embeddedFontNames(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const names = new Set<string>();
  for (const m of raw.matchAll(/\/BaseFont\s*\/([^\s/>]+)/g)) {
    if (m[1] !== undefined) names.add(m[1]);
  }
  return [...names].sort();
}
