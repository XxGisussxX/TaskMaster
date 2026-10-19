import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  assistantActionSchema,
  nlTaskDraftSchema,
  TaskStatus,
  type AiCapabilities,
  type AiChatEntry,
  type AiUsage,
  type AssistantCompleteAction,
  type AssistantReminderAction,
  type AssistantRequest,
  type AssistantResponse,
  type NlTaskDraft,
} from "@taskmaster/contracts";
import type { Prisma } from "@prisma/client";
import {
  detectAssistantIntent,
  resolveCompleteTarget,
  resolveReminderPayload,
  suggestibleTasks,
  type Suggestion,
} from "@taskmaster/domain";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { aiQuotaKey } from "../../redis/redis-keys";
import { redactPii } from "../../common/sanitize/pii";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ConfigService } from "@nestjs/config";
import {
  AiProvider,
  AiProviderError,
  type AiCompletionResult,
  type JsonSchemaSpec,
} from "./ai.types";

const NL_TASK_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "ARCHIVED"],
    },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
    dueDate: { type: "string", nullable: true },
    startDate: { type: "string", nullable: true },
    channelId: { type: "string", nullable: true },
    tagIds: { type: "array", items: { type: "string" } },
    subtasks: { type: "array", items: { type: "string" } },
  },
  required: ["title"],
} as const;

const NL_TASK_SPEC: JsonSchemaSpec<NlTaskDraft> = {
  zod: nlTaskDraftSchema,
  jsonSchema: NL_TASK_JSON_SCHEMA,
};

const ASSISTANT_ADVICE_JSON_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
  },
  required: ["reply"],
} as const;

const assistantAdviceSchema = z.object({
  reply: z.string().trim().min(1).max(800),
});

const ASSISTANT_ADVICE_SPEC: JsonSchemaSpec<{ reply: string }> = {
  zod: assistantAdviceSchema,
  jsonSchema: ASSISTANT_ADVICE_JSON_SCHEMA,
};

interface NlTaskContext {
  tags: string[];
  channels: string[];
}

function isQuotaError(message: string): boolean {
  return /quota|429|resource has been exhausted|daily/i.test(message);
}

/**
 * Tope de tareas abiertas que se le pasan al asistente para resolver intents.
 *
 * Sin cota, un workspace grande materializaba todas sus tareas abiertas en cada
 * mensaje. Se ordenan por vencimiento más próximo, que es lo relevante para
 * "completá X" y recordatorios.
 */
const MAX_ASSISTANT_TASKS = 300;

/**
 * Tope de tags y canales que se listan al modelo al armar un borrador.
 *
 * Es contexto para que elija ids existentes; más allá de este número el modelo
 * no los ve y `sanitizeDraft` descarta igual cualquier id fuera de la lista.
 */
const MAX_DRAFT_CONTEXT_ITEMS = 200;

/**
 * Cuántos turnos del historial persistido se devuelven al frontend.
 *
 * Se cuentan filas (usuario + asistente), así que 40 son ~20 intercambios,
 * en línea con `HISTORY_LIMIT` del cliente.
 */
const AI_CHAT_HISTORY_LIMIT = 40;

interface DailyQuota {
  day: string;
  used: number;
}

@Injectable()
export class AiService {
  private readonly quotaGate = new Map<string, DailyQuota>();
  private readonly quotaSeeds = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly provider: AiProvider,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async generateTaskDraft(
    workspaceId: string,
    userId: string,
    text: string,
  ): Promise<NlTaskDraft> {
    await this.access.assertWriteRole(workspaceId, userId);

    if (!this.provider.isConfigured) {
      throw new ServiceUnavailableException(
        "La IA no está configurada. Agregá GEMINI_API_KEY en el entorno.",
      );
    }

    await this.assertDailyQuota(userId);

    const [tags, channels] = await Promise.all([
      this.prisma.tag.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: MAX_DRAFT_CONTEXT_ITEMS,
      }),
      this.prisma.channel.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: MAX_DRAFT_CONTEXT_ITEMS,
      }),
    ]);

    try {
      const result = await this.provider.completeJson(
        this.buildNlTaskPrompt(redactPii(text).text, {
          tags: tags.map((tag) => tag.name),
          channels: channels.map((channel) => channel.name),
        }),
        NL_TASK_SPEC,
      );

      const draft = this.sanitizeDraft(result.data, {
        tagIds: tags.map((tag) => tag.id),
        channelIds: channels.map((channel) => channel.id),
      });

      await this.logGeneration(
        workspaceId,
        userId,
        "nl-task",
        result,
        "success",
      );
      return draft;
    } catch (error) {
      if (error instanceof AiProviderError) {
        await this.logGeneration(
          workspaceId,
          userId,
          "nl-task",
          {
            latencyMs: 0,
            inputChars: text.length,
            outputChars: 0,
          },
          "error",
          error.message,
        );
        throw new BadGatewayException(
          isQuotaError(error.message)
            ? "Se agotó la cuota de IA (Gemini). Volvé a intentar más tarde o aumentá GEMINI_DAILY_LIMIT."
            : "No pudimos generar la tarea con IA. Intentalo de nuevo.",
        );
      }
      throw error;
    }
  }

  async assistantStep(
    workspaceId: string,
    userId: string,
    body: AssistantRequest,
  ): Promise<AssistantResponse> {
    await this.access.assertWriteRole(workspaceId, userId);

    const { messages, text } = body;
    const lastAssistantText =
      [...messages].reverse().find((m) => m.role === "assistant")?.text ?? "";

    const rows = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: MAX_ASSISTANT_TASKS,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
      },
    });
    const suggestions = suggestibleTasks(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: row.dueDate?.toISOString() ?? null,
        priority: row.priority,
        status: row.status,
      })),
    );

    const intent = detectAssistantIntent(text);

    let response: AssistantResponse;

    if (intent?.kind === "reminder") {
      const resolved = resolveReminderPayload(text, suggestions);
      if (!resolved) {
        response = {
          reply:
            "¿Para cuándo? Decime un momento, por ejemplo: en 1 hora, mañana, en 3 días.",
          actions: [],
        };
      } else {
        const linked = suggestions.find((s) => s.taskId === resolved.taskId);
        const action: AssistantReminderAction = {
          kind: "reminder",
          title: resolved.title,
          triggerAt: resolved.triggerAt.toISOString(),
          taskId: resolved.taskId ?? undefined,
          taskTitle: linked?.title,
        };
        response = {
          reply: `Listo, te recuerdo: "${resolved.title}".`,
          actions: [action],
        };
      }
    } else if (intent?.kind === "complete") {
      const target = resolveCompleteTarget(
        text,
        suggestions,
        lastAssistantText,
      );
      if (!target) {
        response = {
          reply: this.pendingListReply(suggestions),
          actions: [],
        };
      } else {
        const action: AssistantCompleteAction = {
          kind: "complete",
          taskId: target.taskId,
          taskTitle: target.title,
        };
        response = {
          reply: `¿Marco "${target.title}" como completada?`,
          actions: [action],
        };
      }
    } else {
      if (!this.provider.isConfigured) {
        throw new ServiceUnavailableException(
          "La IA no está configurada. Agregá GEMINI_API_KEY en el entorno.",
        );
      }

      await this.assertDailyQuota(userId);

      const prompt = this.buildAssistantAdvicePrompt(
        text,
        messages,
        suggestions,
      );

      try {
        const result = await this.provider.completeJson(
          prompt,
          ASSISTANT_ADVICE_SPEC,
        );
        await this.logGeneration(
          workspaceId,
          userId,
          "assistant-advice",
          result,
          "success",
        );
        response = { reply: result.data.reply, actions: [] };
      } catch (error) {
        if (error instanceof AiProviderError) {
          await this.logGeneration(
            workspaceId,
            userId,
            "assistant-advice",
            { latencyMs: 0, inputChars: text.length, outputChars: 0 },
            "error",
            error.message,
          );
          response = {
            reply: `La IA no estuvo disponible ahora. Igual, tus pendientes:\n${this.pendingList(suggestions)}`,
            actions: [],
          };
        } else {
          throw error;
        }
      }
    }

    await this.persistChatExchange(workspaceId, userId, text, response);
    return response;
  }

  /**
   * Historial persistido del asistente para el usuario en el workspace.
   *
   * Devuelve los últimos `AI_CHAT_HISTORY_LIMIT` turnos en orden cronológico.
   * El frontend se solía perder todo esto al recargar (vivía en `useState`).
   */
  async getChatHistory(
    workspaceId: string,
    userId: string,
  ): Promise<AiChatEntry[]> {
    await this.access.assertMembership(workspaceId, userId);

    const rows = await this.prisma.aiChatEntry.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: "desc" },
      take: AI_CHAT_HISTORY_LIMIT,
    });

    return rows.reverse().map((row) => this.toChatEntryDto(row));
  }

  async clearChatHistory(workspaceId: string, userId: string): Promise<void> {
    await this.access.assertMembership(workspaceId, userId);
    await this.prisma.aiChatEntry.deleteMany({
      where: { workspaceId, userId },
    });
  }

  /**
   * Guarda el par usuario/asistente de un turno.
   *
   * Solo persiste el `user` que llegó y la respuesta; el historial que envía el
   * cliente no se re-escribe (ya está en la base). `actions` se serializa para
   * reconstruir los botones al remontar.
   */
  private async persistChatExchange(
    workspaceId: string,
    userId: string,
    userText: string,
    response: AssistantResponse,
  ): Promise<void> {
    await this.prisma.aiChatEntry.createMany({
      data: [
        { workspaceId, userId, role: "user", text: userText },
        {
          workspaceId,
          userId,
          role: "assistant",
          text: response.reply,
          actions:
            response.actions.length > 0
              ? (response.actions as unknown as Prisma.InputJsonValue)
              : undefined,
        },
      ],
    });
  }

  private toChatEntryDto(row: {
    id: string;
    role: string;
    text: string;
    actions: unknown;
    createdAt: Date;
  }): AiChatEntry {
    const parsedActions = Array.isArray(row.actions)
      ? z.array(assistantActionSchema).safeParse(row.actions)
      : null;

    return {
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      text: row.text,
      actions: parsedActions?.success ? parsedActions.data : [],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private pendingList(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) return "(no tenés tareas abiertas)";
    return suggestions.map((s) => `- ${s.title} (${s.reason})`).join("\n");
  }

  private pendingListReply(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) {
      return "No tenés tareas abiertas.";
    }
    return `¿Cuál marco como hecha?\n\n${this.pendingList(suggestions)}`;
  }

  private buildAssistantAdvicePrompt(
    text: string,
    messages: AssistantRequest["messages"],
    suggestions: Suggestion[],
  ): string {
    const context =
      suggestions.length > 0
        ? suggestions.map((s) => `- ${s.title} (${s.reason})`).join("\n")
        : "(no hay tareas abiertas en el workspace)";
    const history =
      messages.length > 0
        ? messages.map((m) => `${m.role}: ${redactPii(m.text).text}`).join("\n")
        : "(sin historial)";

    return [
      "Sos un copiloto de un gestor de tareas. Das consejos breves y accionables en español.",
      "",
      "Reglas:",
      "- Solo podés referenciar tareas de esta lista real (nunca inventes tareas, ids ni fechas).",
      '- Respondé SOLO un objeto JSON: { "reply": "tu consejo" }. Sin markdown ni texto extra.',
      "- La respuesta es un consejo corto (máx. 300 caracteres): qué hacer o cuál tarea priorizar.",
      "",
      "Tareas abiertas del usuario:",
      context,
      "",
      "Historial del chat:",
      history,
      "",
      `Último mensaje del usuario: "${redactPii(text).text}"`,
    ].join("\n");
  }

  /**
   * Si hay un proveedor operativo y con qué modelo.
   *
   * El frontend lo consulta antes de dibujar el asistente. `GEMINI_API_KEY` es
   * opcional a propósito (una instalación sin IA es válida), así que sin esto la
   * UI dibujaba un orbe que respondía 503 a cada mensaje. A diferencia de
   * `/auth/oauth/providers`, esto exige membresía: no dice si el backend tiene
   * key, sino si el usuario que pregunta puede usar IA en este workspace.
   */
  async getCapabilities(
    workspaceId: string,
    userId: string,
  ): Promise<AiCapabilities> {
    await this.access.assertMembership(workspaceId, userId);

    return {
      configured: this.provider.isConfigured,
      model: this.provider.model,
      dailyLimit: this.config.get<number>("GEMINI_DAILY_LIMIT") ?? 15,
    };
  }

  async getUsage(workspaceId: string, userId: string): Promise<AiUsage> {
    await this.access.assertMembership(workspaceId, userId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usedToday = await this.prisma.aiGeneration.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    return {
      usedToday,
      dailyLimit: this.config.get<number>("GEMINI_DAILY_LIMIT") ?? 15,
    };
  }

  private startOfLocalDay(now = new Date()): Date {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private localDayKey(now = new Date()): string {
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  private todayCount(userId: string): Promise<number> {
    return this.prisma.aiGeneration.count({
      where: {
        userId,
        createdAt: { gte: this.startOfLocalDay() },
      },
    });
  }

  /**
   * Resuelve la cuota diaria del usuario y reserva un consumo.
   *
   * El contador vive en Redis para que el límite se comparta entre réplicas; si
   * Redis no responde, `RedisService.withFallback` degrada al gate en memoria por
   * proceso (el comportamiento previo a esta fase). En ambos caminos la reserva
   * es atómica: en Redis por `INCR` (con `DECR` de reversa si se pasó del
   * límite), y en memoria por una lectura-escritura síncrona sin `await` en el
   * medio.
   */
  private async assertDailyQuota(userId: string): Promise<void> {
    const limit = this.config.get<number>("GEMINI_DAILY_LIMIT") ?? 15;
    const today = this.localDayKey();

    const used = await this.redis.withFallback(
      () => this.consumeQuotaRedis(userId, today, limit),
      () => this.consumeQuotaMemory(userId, today),
      "ai-quota",
    );

    if (used > limit) {
      throw new HttpException(
        `Alcanzaste tu límite diario de IA (${limit}/${limit}). Volvé a intentar mañana o subí GEMINI_DAILY_LIMIT para tu instancia.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Reserva una generación en Redis y devuelve el consumo resultante.
   *
   * Si la key del día no existe la sembramos con el conteo de la base: así un
   * Redis reiniciado a mitad de jornada no regala cuota y el número coincide con
   * `/usage`, que cuenta filas de `AiGeneration`. El `INCR` es la operación
   * atómica que reparte la cuota entre réplicas; si pasa el límite se deshace
   * con `DECR` para no dejar contabilizada una reserva rechazada.
   */
  private async consumeQuotaRedis(
    userId: string,
    day: string,
    limit: number,
  ): Promise<number> {
    const key = aiQuotaKey(this.redis.keyPrefix, userId, day);
    const client = this.redis.client;

    if ((await client.exists(key)) === 0) {
      const seeded = await this.todayCount(userId);
      // `NX` deja ganar a la réplica que llegue primero: las demás no pisan el
      // valor y el `INCR` posterior reparte igual.
      await client.set(
        key,
        String(seeded),
        "EX",
        this.secondsUntilNextLocalDay(),
        "NX",
      );
    }

    const used = await client.incr(key);
    if (used > limit) {
      await client.decr(key);
    }
    return used;
  }

  /**
   * Gate en memoria por proceso, usado solo cuando Redis no está disponible.
   *
   * Siembra el contador desde la base la primera vez del día (y tras un
   * restart) y reserva de forma síncrona: dentro de un mismo proceso dos
   * peticiones concurrentes no pueden superar el límite. No comparte estado
   * entre réplicas, así que en la ventana degradada el límite cuenta por
   * proceso.
   */
  private async consumeQuotaMemory(
    userId: string,
    day: string,
  ): Promise<number> {
    await this.seedDailyQuota(userId, day);

    const current = this.quotaGate.get(userId);
    const used = current && current.day === day ? current.used : 0;
    this.quotaGate.set(userId, { day, used: used + 1 });
    return used + 1;
  }

  private async seedDailyQuota(userId: string, day: string): Promise<void> {
    const existing = this.quotaGate.get(userId);
    if (existing && existing.day === day) return;

    let seeding = this.quotaSeeds.get(userId);
    if (!seeding) {
      seeding = this.todayCount(userId)
        .then((count) => {
          this.quotaGate.set(userId, { day, used: count });
        })
        .finally(() => {
          this.quotaSeeds.delete(userId);
        });
      this.quotaSeeds.set(userId, seeding);
    }
    await seeding;
  }

  /**
   * Segundos hasta el próximo fin de día local, el TTL de la key de cuota.
   *
   * El día también va en el nombre de la key, así que este TTL es solo limpieza:
   * no es la fuente de verdad de a qué jornada pertenece el contador.
   */
  private secondsUntilNextLocalDay(now = new Date()): number {
    const next = this.startOfLocalDay(now);
    next.setDate(next.getDate() + 1);
    return Math.max(1, Math.round((next.getTime() - now.getTime()) / 1000));
  }

  private buildNlTaskPrompt(text: string, ctx: NlTaskContext): string {
    const today = new Date().toISOString().slice(0, 10);
    const tags =
      ctx.tags.length > 0
        ? ctx.tags.join(", ")
        : "(no hay tags creados en el workspace)";
    const channels =
      ctx.channels.length > 0
        ? ctx.channels.join(", ")
        : "(no hay canales creados en el workspace)";

    return [
      "Convertí la descripción siguiente en una tarea de un gestor de tareas.",
      "",
      "Reglas:",
      "- Solo respondé con un objeto JSON válido, sin texto extra ni markdown.",
      "- El título debe ser conciso y accionable, en español, máximo 200 caracteres.",
      `- Usá SOLO fechas YYYY-MM-DD relativas a hoy (${today}).`,
      "- status SOLO puede ser: TODO, IN_PROGRESS, IN_REVIEW, DONE, ARCHIVED.",
      "- priority SOLO puede ser: LOW, MEDIUM, HIGH, URGENT.",
      `- channelId: elegilo SOLO de esta lista de canales existentes: ${channels}. Si ninguno encaja, null.`,
      `- tagIds: elegí SOLO de esta lista de tags existentes: ${tags}. Si no aplica, array vacío.`,
      "- Si la fecha estimada o de inicio no están claras, usá null.",
      "- Si la descripción incluye pasos o subtareas, devolvelos en subtasks (array de strings cortos).",
      "",
      `Descripción: "${text}"`,
    ].join("\n");
  }

  private sanitizeDraft(
    draft: NlTaskDraft,
    ctx: { tagIds: string[]; channelIds: string[] },
  ): NlTaskDraft {
    const validTags = new Set(ctx.tagIds);
    const validChannels = new Set(ctx.channelIds);
    const tagIds = Array.from(
      new Set(draft.tagIds.filter((id) => validTags.has(id))),
    );
    const channelId =
      draft.channelId && validChannels.has(draft.channelId)
        ? draft.channelId
        : null;
    const subtasks = Array.from(
      new Set(draft.subtasks.map((subtask) => subtask.trim()).filter(Boolean)),
    ).slice(0, 20);

    return { ...draft, channelId, tagIds, subtasks };
  }

  private async logGeneration(
    workspaceId: string,
    userId: string,
    feature: string,
    result: Pick<
      AiCompletionResult<unknown>,
      "latencyMs" | "inputChars" | "outputChars"
    >,
    status: "success" | "error",
    error?: string,
  ): Promise<void> {
    await this.prisma.aiGeneration.create({
      data: {
        workspaceId,
        userId,
        feature,
        provider: "gemini",
        model: this.provider.model,
        status,
        latencyMs: result.latencyMs,
        inputChars: result.inputChars,
        outputChars: result.outputChars,
        error,
      },
    });
  }
}
