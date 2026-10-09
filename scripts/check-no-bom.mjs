/**
 * Falla (exit 1) si un archivo `.json` del repo empieza con BOM UTF-8.
 *
 * Un BOM invisible rompe JSON.parse y a PostCSS/vite le cayó "Unexpected token
 * '﻿'" cuando un package.json se guardó con BOM por accidente. Este chequeo
 * existe para que el CI lo atrape antes que el build.
 *
 * Sin dependencias: solo `node:fs`. No recorre node_modules ni directorios de
 * build/store.
 */

import { openSync, readSync, closeSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Directorios que no son fuente del repo y se saltan siempre. */
const SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".pnpm-store",
  ".next",
  ".turbo",
]);

const violations = [];

function hasBom(file) {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(3);
    const bytes = readSync(fd, head, 0, 3, 0);
    return bytes === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  } finally {
    closeSync(fd);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(full);
    } else if (entry.name.endsWith(".json") && hasBom(full)) {
      violations.push(relative(ROOT, full));
    }
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error(`check-no-bom: ${violations.length} .json con BOM UTF-8:`);
  for (const file of violations) console.error(`  - ${file}`);
  console.error("Re-guardá los archivos como UTF-8 sin BOM (UTF-8 en la mayoría de los editores).");
  process.exit(1);
}

console.log(`check-no-bom: ok (ningún .json con BOM en ${relative(process.cwd(), ROOT) || "."})`);