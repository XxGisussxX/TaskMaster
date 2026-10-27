import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { renderToBuffer } from "@react-pdf/renderer";
import { MINIMAL_TEMPLATE } from "./render/config";
import { renderTemplate } from "./render/renderTemplate";
import { parseMarkdown } from "./markdown";

function tenPageDoc(): string {
  const lines: string[] = [];
  for (let s = 1; s <= 12; s++) {
    lines.push(`# Seccion ${s}`);
    lines.push("");
    for (let p = 1; p <= 4; p++) {
      lines.push(
        `Parrafo ${p} de la seccion ${s} con contenido suficiente para ocupar espacio: descripcion de los resultados obtenidos, analisis de tendencias y conclusiones preliminares del equipo.`,
      );
      lines.push("");
    }
    lines.push("- Primer item");
    lines.push("- Segundo item");
    lines.push("- Tercer item");
    lines.push("");
  }
  return lines.join("\n");
}

const ms = (since: number) => Math.round(performance.now() - since);

// Estos tests solo imprimen métricas y bloquean el event loop durante ~1 min
// (20 renders síncronos). En CI el worker de Vitest se cae por el timeout de
// RPC antes de terminar y arrastra el paso `Test` entero. Quedan opt-in:
//   RUN_PERF_TESTS=1 pnpm --filter @taskmaster/templates test
const runPerf = process.env.RUN_PERF_TESTS === "1";

describe.skipIf(!runPerf)("perf (block B)", () => {
  it("times 10-page doc renders", async () => {
    const doc = tenPageDoc();

    let t = performance.now();
    parseMarkdown(doc);
    const parseMs = ms(t);

    t = performance.now();
    for (let i = 0; i < 3; i++) {
      await renderToBuffer(renderTemplate({ content: doc }, MINIMAL_TEMPLATE));
    }
    const firstMs = ms(t) / 3;

    t = performance.now();
    await renderToBuffer(renderTemplate({ content: doc }, MINIMAL_TEMPLATE));
    const singleMs = ms(t);

    console.log(`PERF warm=${firstMs}ms last=${singleMs}ms`);

    // Busca "Página N de M" para contar páginas.
    const buffer = await renderToBuffer(
      renderTemplate({ content: doc }, MINIMAL_TEMPLATE),
    );
    const pages = Math.max(
      0,
      ...[...buffer.toString("latin1").matchAll(/de (\d+)/g)].map((m) =>
        Number(m[1]),
      ),
    );

    console.log(
      `PERF parse=${parseMs}ms warm/${singleMs}ms pages=${pages} approx10Pages=${pages}`,
    );
    console.log("PERF renderTemplate element build avg (µs)");

    expect(buffer.length).toBeGreaterThan(0);
  });

  it("simulates rapid-change: 20 naive renders vs 1 debounced", async () => {
    const doc = tenPageDoc();

    let t = performance.now();
    for (let i = 0; i < 20; i++) {
      const patch = `${doc}\n\nCambio ${i}`;
      await renderToBuffer(
        renderTemplate({ content: patch }, MINIMAL_TEMPLATE),
      );
    }
    const naive = ms(t);

    t = performance.now();
    const finalDoc = `${doc}\n\nCambio 19`;
    await renderToBuffer(
      renderTemplate({ content: finalDoc }, MINIMAL_TEMPLATE),
    );
    const debounced = ms(t);

    console.log(`PERF naive20=${naive}ms debounced1=${debounced}ms`);
    expect(true).toBe(true);
  });
});
