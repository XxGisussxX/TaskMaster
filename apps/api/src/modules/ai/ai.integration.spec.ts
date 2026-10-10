import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "./gemini.provider";

/**
 * Test de integración real contra la API de Gemini (paga, no determinista).
 *
 * Solo corre si hay GEMINI_API_KEY **Y** `RUN_AI_INTEGRATION=1`: la key sola
 * no alcanza para que una `pnpm test` local le pegue a la API por accidente.
 * Sin el opt-in explícito se salta, igual que en CI (donde no se pasan ni la
 * key ni la variable). Ejecutar en local con:
 *
 *   $env:RUN_AI_INTEGRATION="1"; pnpm --filter @taskmaster/api test
 */

function loadValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(
      new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, "m"),
    );
    const raw = match?.[1];
    if (!raw) return undefined;
    const value = raw.replace(/^["']|["']$/g, "");
    process.env[name] = value;
    return value;
  } catch {
    return undefined;
  }
}

const apiKey = loadValue("GEMINI_API_KEY");
const runIntegration = loadValue("RUN_AI_INTEGRATION");

const provider = new GeminiProvider({
  apiKey,
  model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
});

const todoSchema = z.object({ title: z.string() });

const shouldRunIntegration = Boolean(apiKey) && runIntegration === "1";

describe.skipIf(!shouldRunIntegration)(
  "GeminiProvider (integración real)",
  () => {
    it("completa un JSON estructurado desde la API", async () => {
      const result = await provider.completeJson(
        "Respondé únicamente con un JSON válido cuyo campo title sea la tarea 'Comprar leche'.",
        {
          zod: todoSchema,
          jsonSchema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
        },
      );

      expect(result.data.title).toContain("leche");
    }, 110_000);
  },
);
