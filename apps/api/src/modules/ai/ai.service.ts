import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  nlTaskDraftSchema,
  TaskStatus,
  type AiCapabilities,
  type AiUsage,
  type AssistantCompleteAction,
  type AssistantReminderAction,
  type AssistantRequest,
  type AssistantResponse,
  type NlTaskDraft,
} from "@taskmaster/contracts";
import {
  detectAssistantIntent,
  resolveCompleteTarget,
  resolveReminderPayload,
  suggestibleTasks,
  type Suggestion,
} from "@taskmaster/domain";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
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
    categoryId: { type: "string", nullable: true },
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
  categories: string[];
}

function isQuotaError(message: string): boolean {
  return /quota|429|resource has been exhausted|daily/i.test(message);
}

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

    const [tags, categories] = await Promise.all([
      this.prisma.tag.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      }),
      this.prisma.category.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      }),
    ]);

    try {
      const result = await this.provider.completeJson(
        this.buildNlTaskPrompt(text, {
          tags: tags.map((tag) => tag.name),
          categories: categories.map((category) => category.name),
        }),
        NL_TASK_SPEC,
      );

      const draft = this.sanitizeDraft(result.data, {
        tagIds: tags.map((tag) => tag.id),
        categoryIds: categories.map((category) => category.id),
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

    if (intent?.kind === "reminder") {
      const resolved = resolveReminderPayload(text, suggestions);
      if (!resolved) {
        return {
          reply:
            "¿Para cuándo? Decime un momento, por ejemplo: en 1 hora, mañana, en 3 días.",
          actions: [],
        };
      }
      const linked = suggestions.find((s) => s.taskId === resolved.taskId);
      const action: AssistantReminderAction = {
        kind: "reminder",
        title: resolved.title,
        triggerAt: resolved.triggerAt.toISOString(),
        taskId: resolved.taskId ?? undefined,
        taskTitle: linked?.title,
      };
      return {
        reply: `Listo, te recuerdo: "${resolved.title}".`,
        actions: [action],
      };
    }

    if (intent?.kind === "complete") {
      const target = resolveCompleteTarget(
        text,
        suggestions,
        lastAssistantText,
      );
      if (!target) {
        return {
          reply: this.pendingListReply(suggestions),
          actions: [],
        };
      }
      const action: AssistantCompleteAction = {
        kind: "complete",
        taskId: target.taskId,
        taskTitle: target.title,
      };
      return {
        reply: `¿Marco "${target.title}" como completada?`,
        actions: [action],
      };
    }

    if (!this.provider.isConfigured) {
      throw new ServiceUnavailableException(
        "La IA no está configurada. Agregá GEMINI_API_KEY en el entorno.",
      );
    }

    await this.assertDailyQuota(userId);

    const prompt = this.buildAssistantAdvicePrompt(text, messages, suggestions);

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
      return { reply: result.data.reply, actions: [] };
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
        return {
          reply: `La IA no estuvo disponible ahora. Igual, tus pendientes:\n${this.pendingList(suggestions)}`,
          actions: [],
        };
      }
      throw error;
    }
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
        ? messages.map((m) => `${m.role}: ${m.text}`).join("\n")
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
      `Último mensaje del usuario: "${text}"`,
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
   * Sembra el contador en memoria desde la base la primera vez al día (y
   * tras un restart). La reserva posterior es síncrona, sin await entre
   * lectura y escritura, por lo que es atómica dentro del proceso: dos
   * peticiones concurrentes no pueden superar el límite.
   */
  private async seedDailyQuota(userId: string): Promise<void> {
    const today = this.localDayKey();
    const existing = this.quotaGate.get(userId);
    if (existing && existing.day === today) return;

    let seeding = this.quotaSeeds.get(userId);
    if (!seeding) {
      seeding = this.todayCount(userId)
        .then((count) => {
          this.quotaGate.set(userId, { day: today, used: count });
        })
        .finally(() => {
          this.quotaSeeds.delete(userId);
        });
      this.quotaSeeds.set(userId, seeding);
    }
    await seeding;
  }

  private async assertDailyQuota(userId: string): Promise<void> {
    await this.seedDailyQuota(userId);

    const limit = this.config.get<number>("GEMINI_DAILY_LIMIT") ?? 15;
    const today = this.localDayKey();
    const current = this.quotaGate.get(userId);
    const used = current && current.day === today ? current.used : 0;

    if (used >= limit) {
      throw new HttpException(
        `Alcanzaste tu límite diario de IA (${used}/${limit}). Volvé a intentar mañana o subí GEMINI_DAILY_LIMIT para tu instancia.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.quotaGate.set(userId, { day: today, used: used + 1 });
  }

  private buildNlTaskPrompt(text: string, ctx: NlTaskContext): string {
    const today = new Date().toISOString().slice(0, 10);
    const tags =
      ctx.tags.length > 0
        ? ctx.tags.join(", ")
        : "(no hay tags creados en el workspace)";
    const categories =
      ctx.categories.length > 0
        ? ctx.categories.join(", ")
        : "(no hay categorías creadas en el workspace)";

    return [
      "Convertí la descripción siguiente en una tarea de un gestor de tareas.",
      "",
      "Reglas:",
      "- Solo respondé con un objeto JSON válido, sin texto extra ni markdown.",
      "- El título debe ser conciso y accionable, en español, máximo 200 caracteres.",
      `- Usá SOLO fechas YYYY-MM-DD relativas a hoy (${today}).`,
      "- status SOLO puede ser: TODO, IN_PROGRESS, IN_REVIEW, DONE, ARCHIVED.",
      "- priority SOLO puede ser: LOW, MEDIUM, HIGH, URGENT.",
      `- categoryId: elegilo SOLO de esta lista de categorías existentes: ${categories}. Si ninguna encaja, null.`,
      `- tagIds: elegí SOLO de esta lista de tags existentes: ${tags}. Si no aplica, array vacío.`,
      "- Si la fecha estimada o de inicio no están claras, usá null.",
      "- Si la descripción incluye pasos o subtareas, devolvelos en subtasks (array de strings cortos).",
      "",
      `Descripción: "${text}"`,
    ].join("\n");
  }

  private sanitizeDraft(
    draft: NlTaskDraft,
    ctx: { tagIds: string[]; categoryIds: string[] },
  ): NlTaskDraft {
    const validTags = new Set(ctx.tagIds);
    const validCategories = new Set(ctx.categoryIds);
    const tagIds = Array.from(
      new Set(draft.tagIds.filter((id) => validTags.has(id))),
    );
    const categoryId =
      draft.categoryId && validCategories.has(draft.categoryId)
        ? draft.categoryId
        : null;
    const subtasks = Array.from(
      new Set(draft.subtasks.map((subtask) => subtask.trim()).filter(Boolean)),
    ).slice(0, 20);

    return { ...draft, categoryId, tagIds, subtasks };
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
