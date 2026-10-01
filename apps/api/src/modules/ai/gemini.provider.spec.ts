import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiProvider } from "./gemini.provider";
import { AiNotConfiguredError, AiProviderError } from "./ai.types";

const schema = z.object({ title: z.string() });
const spec = { zod: schema, jsonSchema: {} };

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const res = {
    ok,
    status,
    text: vi
      .fn()
      .mockResolvedValue(
        typeof body === "string" ? body : JSON.stringify(body),
      ),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res as unknown as Response));
}

function mockFetchSequence(
  ...responses: Array<{ body: unknown; ok?: boolean; status?: number }>
) {
  const mocks = responses.map((r) => ({
    ok: r.ok ?? true,
    status: r.status ?? 200,
    text: vi
      .fn()
      .mockResolvedValue(
        typeof r.body === "string" ? r.body : JSON.stringify(r.body),
      ),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const next = mocks.shift();
      if (!next) {
        return Promise.reject(new Error("No hay más respuestas simuladas"));
      }
      return Promise.resolve(next as unknown as Response);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiProvider", () => {
  it("no está configurado sin api key", () => {
    const provider = new GeminiProvider({
      apiKey: "",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });

    expect(provider.isConfigured).toBe(false);
    expect(provider.model).toBe("gemini-3.6-flash");
  });

  it("lanza AiNotConfiguredError si falta la api key", async () => {
    const provider = new GeminiProvider({
      apiKey: undefined,
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });

    await expect(provider.completeJson("hola", spec)).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
  });

  it("parsea la respuesta JSON y devuelve métricas", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchOnce({
      candidates: [{ content: { parts: [{ text: '{"title":"Hola"}' }] } }],
    });

    const result = await provider.completeJson("Descripción", spec);

    expect(result.data).toEqual({ title: "Hola" });
    expect(result.inputChars).toBe("Descripción".length);
    expect(result.outputChars).toBeGreaterThan(0);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("soporta respuestas envueltas en fences de markdown", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchOnce({
      candidates: [
        { content: { parts: [{ text: '```json\n{"title":"Hola"}\n```' }] } },
      ],
    });

    const result = await provider.completeJson("Descripción", spec);

    expect(result.data.title).toBe("Hola");
  });

  it("lanza AiProviderError si el status HTTP no es ok", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchOnce({ error: { message: "invalid api key" } }, false, 400);

    await expect(
      provider.completeJson("Descripción", spec),
    ).rejects.toBeInstanceOf(AiProviderError);
  });

  it("lanza AiProviderError si la respuesta no coincide con el esquema", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchOnce({
      candidates: [{ content: { parts: [{ text: '{"campo":"otro"}' }] } }],
    });

    await expect(
      provider.completeJson("Descripción", spec),
    ).rejects.toBeInstanceOf(AiProviderError);
  });

  it("lanza AiProviderError si el JSON no es válido", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchOnce({
      candidates: [{ content: { parts: [{ text: "esto no es json" }] } }],
    });

    await expect(
      provider.completeJson("Descripción", spec),
    ).rejects.toBeInstanceOf(AiProviderError);
  });

  it("reintenta y tiene éxito si el 503 es transitorio", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchSequence(
      {
        body: { error: { message: "high demand" } },
        ok: false,
        status: 503,
      },
      {
        body: {
          candidates: [{ content: { parts: [{ text: '{"title":"Hola"}' }] } }],
        },
      },
    );

    const result = await provider.completeJson("Descripción", spec);

    expect(result.data).toEqual({ title: "Hola" });
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("reintenta hasta agotar los intentos ante 503 persistente", async () => {
    const provider = new GeminiProvider({
      apiKey: "k",
      model: "gemini-3.6-flash",
      embeddingModel: "text-embedding-004",
    });
    mockFetchSequence(
      { body: { error: {} }, ok: false, status: 503 },
      { body: { error: {} }, ok: false, status: 503 },
      { body: { error: {} }, ok: false, status: 503 },
    );

    await expect(
      provider.completeJson("Descripción", spec),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(fetch).toHaveBeenCalledTimes(3);
  }, 15_000);
});
