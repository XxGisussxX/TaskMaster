import {
  AiNotConfiguredError,
  AiProvider,
  AiProviderError,
  type AiCompletionResult,
  type JsonSchemaSpec,
} from "./ai.types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_500;

/** Status HTTP transitorios: conviene reintentar antes de fallar. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiProviderConfig {
  apiKey?: string;
  model: string;
  embeddingModel: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
}

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
}

export class GeminiProvider extends AiProvider {
  constructor(private readonly config: GeminiProviderConfig) {
    super();
  }

  override get model(): string {
    return this.config.model;
  }

  override get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  override async completeJson<T>(
    prompt: string,
    spec: JsonSchemaSpec<T>,
  ): Promise<AiCompletionResult<T>> {
    this.ensureConfigured();

    const started = Date.now();
    // La clave va por cabecera (x-goog-api-key), como recomienda la doc oficial
    // de la Gemini API: nunca viaja en la URL, así no aparece en proxies, logs
    // ni en el error si la request falla.
    const url = `${API_BASE}/models/${encodeURIComponent(
      this.config.model,
    )}:generateContent`;
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: spec.jsonSchema,
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.apiKey ?? "",
          },
          body,
          signal: controller.signal,
        });

        const raw = await response.text();
        if (!response.ok) {
          if (
            RETRYABLE_STATUS.has(response.status) &&
            attempt < MAX_ATTEMPTS - 1
          ) {
            await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
            continue;
          }
          throw new AiProviderError(
            `Gemini respondió ${response.status}: ${raw.slice(0, 300)}`,
          );
        }

        const parsed = JSON.parse(raw) as GeminiGenerateResponse;
        const text = (parsed.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text)
          .join("");

        return {
          data: this.parseJson<T>(text, spec),
          latencyMs: Date.now() - started,
          inputChars: prompt.length,
          outputChars: text.length,
        };
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "Gemini tardó demasiado en responder"
            : error instanceof Error
              ? error.message
              : "Error al llamar a Gemini";
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new AiProviderError(message);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AiProviderError("No se pudo completar la solicitud a Gemini");
  }

  override async embed(text: string): Promise<number[]> {
    this.ensureConfigured();

    const url = `${API_BASE}/models/${encodeURIComponent(
      this.config.embeddingModel,
    )}:embedContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.config.apiKey ?? "",
      },
      body: JSON.stringify({
        model: `models/${this.config.embeddingModel}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new AiProviderError(
        `Embeddings (${response.status}): ${raw.slice(0, 300)}`,
      );
    }

    const body = (await response.json()) as GeminiEmbedResponse;
    const values = body.embedding?.values;
    if (!values) {
      throw new AiProviderError("Gemini no devolvió un vector de embeddings");
    }
    return values;
  }

  private ensureConfigured(): void {
    if (!this.config.apiKey) throw new AiNotConfiguredError();
  }

  private parseJson<T>(text: string, spec: JsonSchemaSpec<T>): T {
    const cleaned = this.extractJson(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new AiProviderError("Gemini devolvió JSON inválido");
    }
    const result = spec.zod.safeParse(parsed);
    if (!result.success) {
      throw new AiProviderError(
        "La respuesta de Gemini no coincidió con el esquema esperado",
      );
    }
    return result.data;
  }

  private extractJson(raw: string): string {
    const text = raw.trim();
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced?.[1]) return fenced[1].trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) return text.slice(start, end + 1);
    return text;
  }
}
