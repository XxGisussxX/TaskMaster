import type { z } from "zod";

export interface JsonSchemaSpec<T> {
  zod: z.ZodType<T, z.ZodTypeDef, unknown>;
  jsonSchema: Record<string, unknown>;
}

export interface AiCompletionResult<T> {
  data: T;
  latencyMs: number;
  inputChars: number;
  outputChars: number;
}

/**
 * Contrato de proveedor de IA. La app depende de esta abstracción, no del SDK
 * de un proveedor puntual, para poder migrar (p. ej. Ollama) sin tocar services.
 */
export abstract class AiProvider {
  abstract get model(): string;
  abstract get isConfigured(): boolean;
  abstract completeJson<T>(
    prompt: string,
    spec: JsonSchemaSpec<T>,
  ): Promise<AiCompletionResult<T>>;
  abstract embed(text: string): Promise<number[]>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("La IA no está configurada");
    this.name = "AiNotConfiguredError";
  }
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}
