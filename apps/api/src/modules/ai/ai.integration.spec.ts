import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "./gemini.provider";

/**
 * Test de integración real contra la API de Gemini. Se salta automáticamente si
 * no hay GEMINI_API_KEY (se lee de `apps/api/.env`), para no romper la suite
 * sin credenciales. Ejecutar en local: `pnpm --filter @taskmaster/api test`.
 */

function loadApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m);
    const raw = match?.[1];
    if (!raw) return undefined;
    const value = raw.replace(/^["']|["']$/g, "");
    process.env.GEMINI_API_KEY = value;
    return value;
  } catch {
    return undefined;
  }
}

const apiKey = loadApiKey();
const provider = new GeminiProvider({
  apiKey,
  model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
});

const todoSchema = z.object({ title: z.string() });

describe.skipIf(!apiKey)("GeminiProvider (integración real)", () => {
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
});
