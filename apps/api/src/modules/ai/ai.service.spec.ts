import { describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AiProviderError } from "./ai.types";
import { AiService } from "./ai.service";

/**
 * Cliente Redis falso para el contador de cuota.
 *
 * Implementa solo lo que usa `AiService.consumeQuotaRedis` (`EXISTS`, `SET …
 * NX`, `INCR`, `DECR`) sobre un `Map`, con un interruptor `enabled` para simular
 * un Redis caído y forzar el camino de fallback.
 */
function createFakeRedisClient() {
  const store = new Map<string, number>();
  const state = { enabled: true };
  const up = () => {
    if (!state.enabled) throw new Error("Redis no disponible");
  };
  return {
    state,
    store,
    async exists(key: string) {
      up();
      return store.has(key) ? 1 : 0;
    },
    async set(key: string, value: string, ...args: unknown[]) {
      up();
      if (!args.includes("NX") || !store.has(key)) {
        store.set(key, parseInt(value, 10));
      }
      return "OK";
    },
    async incr(key: string) {
      up();
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async decr(key: string) {
      up();
      const next = (store.get(key) ?? 0) - 1;
      store.set(key, next);
      return next;
    },
  };
}

function setup(configured = true) {
  const prisma = {
    tag: {
      findMany: vi.fn().mockResolvedValue([
        { id: "tag-1", name: "Urgente" },
        { id: "tag-2", name: "Cliente" },
      ]),
    },
    channel: {
      findMany: vi.fn().mockResolvedValue([{ id: "ch-1", name: "Trabajo" }]),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aiGeneration: {
      create: vi.fn().mockResolvedValue({ id: "g1" }),
      count: vi.fn().mockResolvedValue(3),
    },
    aiChatEntry: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue(undefined),
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const provider = {
    isConfigured: configured,
    model: "gemini-3.6-flash",
    completeJson: vi.fn(),
    embed: vi.fn(),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === "GEMINI_DAILY_LIMIT" ? 15 : undefined,
    ),
  };
  const client = createFakeRedisClient();
  const redis = {
    keyPrefix: "taskmaster",
    client,
    // Réplica de la semántica de `RedisService.withFallback`: si la operación
    // falla, corre el fallback en memoria.
    withFallback: vi.fn(
      async (operation: () => unknown, fallback: () => unknown) => {
        try {
          return await operation();
        } catch {
          return await fallback();
        }
      },
    ),
  };
  const service = new AiService(
    prisma as never,
    access as never,
    provider as never,
    config as never,
    redis as never,
  );
  return { service, prisma, access, provider, config, redis, client };
}

describe("AiService.generateTaskDraft", () => {
  it("valida el rol de escritura antes de llamar al proveedor", async () => {
    const { service, access, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: { title: "Tarea", description: "", tagIds: [], subtasks: [] },
      latencyMs: 10,
      inputChars: 5,
      outputChars: 5,
    });

    await service.generateTaskDraft("ws1", "u1", "Tarea");

    expect(access.assertWriteRole).toHaveBeenCalledWith("ws1", "u1");
  });

  it("lanza 503 si la IA no está configurada", async () => {
    const { service, provider } = setup(false);

    await expect(
      service.generateTaskDraft("ws1", "u1", "Tarea"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("consulta tags y canales del workspace para el contexto", async () => {
    const { service, prisma, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: { title: "Tarea", description: "", tagIds: [], subtasks: [] },
      latencyMs: 10,
      inputChars: 5,
      outputChars: 5,
    });

    await service.generateTaskDraft("ws1", "u1", "Tarea");

    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: expect.any(Number),
    });
    expect(prisma.channel.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: expect.any(Number),
    });
  });

  it("sanitiza ids inválidos y subtareas vacías, y registra el éxito", async () => {
    const { service, prisma, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: {
        title: "Preparar informe",
        description: "Para el lunes",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-09-18",
        startDate: null,
        channelId: "ch-inexistente",
        tagIds: ["tag-1", "tag-inexistente", "tag-1"],
        subtasks: ["  Reunir datos  ", "", "Redactar"],
      },
      latencyMs: 120,
      inputChars: 20,
      outputChars: 180,
    });

    const draft = await service.generateTaskDraft(
      "ws1",
      "u1",
      "Preparar informe",
    );

    expect(draft.channelId).toBeNull();
    expect(draft.tagIds).toEqual(["tag-1"]);
    expect(draft.subtasks).toEqual(["Reunir datos", "Redactar"]);
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws1",
        userId: "u1",
        feature: "nl-task",
        provider: "gemini",
        model: "gemini-3.6-flash",
        status: "success",
        latencyMs: 120,
      }),
    });
  });

  it("traduce errores del proveedor a 502 y registra el error", async () => {
    const { service, prisma, provider } = setup();
    provider.completeJson.mockRejectedValue(new AiProviderError("boom"));

    await expect(
      service.generateTaskDraft("ws1", "u1", "Tarea"),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "error",
        error: "boom",
      }),
    });
  });

  it("respeta los ids válidos de canales", async () => {
    const { service, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: {
        title: "Tarea",
        description: "",
        channelId: "ch-1",
        tagIds: [],
        subtasks: [],
      },
      latencyMs: 10,
      inputChars: 5,
      outputChars: 5,
    });

    const draft = await service.generateTaskDraft("ws1", "u1", "Tarea");

    expect(draft.channelId).toBe("ch-1");
  });
});

describe("AiService.assistantStep", () => {
  const baseMessages = [{ role: "assistant" as const, text: "Hola" }];

  it("valida el rol de escritura antes de responder", async () => {
    const { service, access, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: { reply: "Hola" },
      latencyMs: 5,
      inputChars: 4,
      outputChars: 4,
    });
    await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "Hola",
    });
    expect(access.assertWriteRole).toHaveBeenCalledWith("ws1", "u1");
  });

  it("resuelve 'recordáme en X' sin consumir IA", async () => {
    const { service, provider, prisma } = setup();
    provider.completeJson.mockResolvedValue({
      data: {},
      latencyMs: 0,
      inputChars: 0,
      outputChars: 0,
    });

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "recordame en 1 hora revisar el informe",
    });

    expect(res.actions).toHaveLength(1);
    expect(res.actions[0]).toMatchObject({
      kind: "reminder",
      title: "revisar el informe",
    });
    expect(
      Date.parse((res.actions[0] as { triggerAt: string }).triggerAt) -
        Date.now(),
    ).toBeGreaterThan(3_000_000);
    expect(provider.completeJson).not.toHaveBeenCalled();
    expect(prisma.aiGeneration.create).not.toHaveBeenCalled();
  });

  it("vincula el recordatorio a la tarea mencionada", async () => {
    const { service } = setup();
    (
      service as unknown as {
        prisma: { task: { findMany: ReturnType<typeof vi.fn> } };
      }
    ).prisma.task.findMany.mockResolvedValue([
      {
        id: "t-1",
        title: "Preparar demo",
        dueDate: null,
        priority: "HIGH",
        status: "TODO",
      },
    ]);

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "recordame en 2 horas terminar preparar demo",
    });

    expect(res.actions[0]).toMatchObject({
      kind: "reminder",
      taskId: "t-1",
    });
  });

  it("pide cuándo si el recordatorio no tiene momento claro", async () => {
    const { service, provider } = setup();

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "recordame revisar los mails",
    });

    expect(res.actions).toEqual([]);
    expect(res.reply.toLowerCase()).toContain("cuándo");
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("marca la tarea mencionada explícitamente", async () => {
    const { service, provider } = setup();
    (
      service as unknown as {
        prisma: { task: { findMany: ReturnType<typeof vi.fn> } };
      }
    ).prisma.task.findMany.mockResolvedValue([
      {
        id: "t-1",
        title: "Preparar demo",
        dueDate: null,
        priority: "HIGH",
        status: "TODO",
      },
    ]);

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "ya esta listo preparar demo",
    });

    expect(res.actions[0]).toEqual({
      kind: "complete",
      taskId: "t-1",
      taskTitle: "Preparar demo",
    });
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("pide aclarar cuál cuando no puede resolver la completada", async () => {
    const { service, provider } = setup();
    (
      service as unknown as {
        prisma: { task: { findMany: ReturnType<typeof vi.fn> } };
      }
    ).prisma.task.findMany.mockResolvedValue([
      {
        id: "t-1",
        title: "Preparar demo",
        dueDate: null,
        priority: "URGENT",
        status: "TODO",
      },
    ]);

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "ya esta listo",
    });

    expect(res.actions).toEqual([]);
    expect(res.reply).toContain("Preparar demo");
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("pide aclarar cuál cuando no hay tareas sugeridas", async () => {
    const { service } = setup();

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "ya esta listo",
    });

    expect(res.reply).toBe("No tenés tareas abiertas.");
    expect(res.actions).toEqual([]);
  });

  it("usa Gemini para consejo sin intención y registra éxito", async () => {
    const { service, provider, prisma } = setup();
    provider.completeJson.mockResolvedValue({
      data: { reply: "Arrancá por la demo." },
      latencyMs: 210,
      inputChars: 20,
      outputChars: 30,
    });

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "que hago primero?",
    });

    expect(res.reply).toBe("Arrancá por la demo.");
    expect(provider.completeJson).toHaveBeenCalledTimes(1);
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feature: "assistant-advice",
        status: "success",
      }),
    });
  });

  it("no rompe el chat si Gemini falla y registra el error", async () => {
    const { service, provider, prisma } = setup();
    provider.completeJson.mockRejectedValue(new AiProviderError("boom"));

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "que hago primero?",
    });

    expect(res.reply).toContain("(no tenés tareas abiertas)");
    expect(prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feature: "assistant-advice",
        status: "error",
        error: "boom",
      }),
    });
  });

  it("lanza 503 solo si el consejo necesita la LLM y no está configurada", async () => {
    const { service } = setup(false);

    await expect(
      service.assistantStep("ws1", "u1", {
        messages: baseMessages,
        text: "que hago primero?",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const res = await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "recordame en 1 hora revisar el informe",
    });
    expect(res.actions[0]).toMatchObject({ kind: "reminder" });
  });

  it("acota las tareas abiertas que lee (las más próximas por vencimiento)", async () => {
    const { service, prisma } = setup();

    await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "ya esta listo",
    });

    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws1",
        status: { notIn: ["DONE", "ARCHIVED"] },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: expect.any(Number),
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
      },
    });
  });

  it("persiste el turno usuario/asistente con las acciones", async () => {
    const { service, prisma } = setup();

    await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "recordame en 1 hora comprar pan",
    });

    expect(prisma.aiChatEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          workspaceId: "ws1",
          userId: "u1",
          role: "user",
          text: "recordame en 1 hora comprar pan",
        },
        {
          workspaceId: "ws1",
          userId: "u1",
          role: "assistant",
          text: expect.any(String),
          actions: [
            expect.objectContaining({ kind: "reminder", title: "comprar pan" }),
          ],
        },
      ],
    });
  });

  it("no guarda acciones cuando la respuesta no trae ninguna", async () => {
    const { service, prisma } = setup();
    prisma.aiChatEntry.createMany.mockClear();

    await service.assistantStep("ws1", "u1", {
      messages: baseMessages,
      text: "ya esta listo",
    });

    const data = prisma.aiChatEntry.createMany.mock.calls[0]?.[0]?.data as {
      actions?: unknown;
    }[];
    expect(data[1]?.actions).toBeUndefined();
  });
});

describe("AiService.getChatHistory", () => {
  it("valida membresía y devuelve los turnos en orden cronológico", async () => {
    const { service, prisma, access } = setup();
    prisma.aiChatEntry.findMany.mockResolvedValue([
      {
        id: "c2",
        role: "assistant",
        text: "hola",
        actions: [{ kind: "complete", taskId: "t1", taskTitle: "T" }],
        createdAt: new Date("2026-10-19T10:05:00Z"),
      },
      {
        id: "c1",
        role: "user",
        text: "que hago",
        actions: null,
        createdAt: new Date("2026-10-19T10:00:00Z"),
      },
    ]);

    const entries = await service.getChatHistory("ws1", "u1");

    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
    expect(entries.map((e) => e.id)).toEqual(["c1", "c2"]);
    expect(entries[1]?.actions).toHaveLength(1);
  });

  it("descarta acciones con forma inesperada", async () => {
    const { service, prisma } = setup();
    prisma.aiChatEntry.findMany.mockResolvedValue([
      {
        id: "c1",
        role: "assistant",
        text: "hola",
        actions: [{ kind: "nope" }],
        createdAt: new Date("2026-10-19T10:00:00Z"),
      },
    ]);

    const entries = await service.getChatHistory("ws1", "u1");

    expect(entries[0]?.actions).toEqual([]);
  });
});

describe("AiService.clearChatHistory", () => {
  it("valida membresía y borra solo los turnos del usuario", async () => {
    const { service, prisma, access } = setup();

    await service.clearChatHistory("ws1", "u1");

    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
    expect(prisma.aiChatEntry.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws1", userId: "u1" },
    });
  });
});

describe("AiService.límite diario (Redis con fallback en memoria)", () => {
  const okResult = {
    data: { title: "Tarea", description: "", tagIds: [], subtasks: [] },
    latencyMs: 10,
    inputChars: 5,
    outputChars: 5,
  };

  function expectTooMany(error: unknown): void {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async function capture(run: () => Promise<unknown>): Promise<unknown> {
    try {
      await run();
      return undefined;
    } catch (error) {
      return error;
    }
  }

  it("rechaza con 429 cuando el usuario alcanzó el límite de hoy", async () => {
    const { service, prisma, provider } = setup();
    prisma.aiGeneration.count.mockResolvedValue(15);

    expectTooMany(
      await capture(() => service.generateTaskDraft("ws1", "u1", "Tarea")),
    );
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("persiste la reserva entre llamadas: la segunda consecutiva al límite es 429 sin llamar al provider", async () => {
    const { service, prisma, provider } = setup();
    provider.completeJson.mockResolvedValue(okResult);
    prisma.aiGeneration.count.mockResolvedValue(14);

    await service.generateTaskDraft("ws1", "u1", "Tarea");
    expectTooMany(
      await capture(() => service.generateTaskDraft("ws1", "u1", "Otra tarea")),
    );
    expect(provider.completeJson).toHaveBeenCalledTimes(1);
  });

  it("no supera el límite con dos peticiones concurrentes (reserva atómica)", async () => {
    const { service, prisma, provider } = setup();
    provider.completeJson.mockResolvedValue(okResult);
    prisma.aiGeneration.count.mockResolvedValue(14);

    const results = await Promise.allSettled([
      service.generateTaskDraft("ws1", "u1", "Tarea A"),
      service.generateTaskDraft("ws1", "u1", "Tarea B"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    let rejected429 = 0;
    for (const r of results) {
      if (r.status === "rejected") {
        expectTooMany(r.reason);
        rejected429 += 1;
      }
    }

    expect(fulfilled).toBe(1);
    expect(rejected429).toBe(1);
    expect(provider.completeJson).toHaveBeenCalledTimes(1);
  });

  it("no consume cuota cuando el asistente resuelve intents sin LLM (p. ej. recordatorio)", async () => {
    const { service, prisma, provider } = setup();
    prisma.aiGeneration.count.mockResolvedValue(15);

    const res = await service.assistantStep("ws1", "u1", {
      messages: [{ role: "assistant", text: "Hola" }],
      text: "recordame en 1 hora revisar los mails",
    });

    expect(res.actions[0]).toMatchObject({ kind: "reminder" });
    expect(provider.completeJson).not.toHaveBeenCalled();
    expect((res.actions[0] as { triggerAt: string }).triggerAt).toBeDefined();
  });

  it("rechaza con 429 el consejo del asistente al límite", async () => {
    const { service, prisma, provider } = setup();
    prisma.aiGeneration.count.mockResolvedValue(15);

    expectTooMany(
      await capture(() =>
        service.assistantStep("ws1", "u1", {
          messages: [{ role: "assistant", text: "Hola" }],
          text: "que hago primero?",
        }),
      ),
    );
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it("sembra la key diaria desde la base y reserva ahí, no solo en memoria", async () => {
    const { service, prisma, provider, client, redis } = setup();
    provider.completeJson.mockResolvedValue(okResult);
    prisma.aiGeneration.count.mockResolvedValue(3);

    await service.generateTaskDraft("ws1", "u1", "Tarea");

    const keys = [...client.store.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^taskmaster:ai:quota:u1:\d{4}-\d{1,2}-\d{1,2}$/);
    expect(client.store.get(keys[0]!)).toBe(4);
    expect(redis.withFallback).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      "ai-quota",
    );
  });

  it("deshace con DECR la reserva rechazada para no dejar la cuota arriba del límite", async () => {
    const { service, prisma, provider, client } = setup();
    prisma.aiGeneration.count.mockResolvedValue(15);

    expectTooMany(
      await capture(() => service.generateTaskDraft("ws1", "u1", "Tarea")),
    );

    expect(provider.completeJson).not.toHaveBeenCalled();
    expect([...client.store.values()]).toEqual([15]);
  });

  it("cae al gate en memoria por proceso cuando Redis no responde (fail-open)", async () => {
    const { service, prisma, provider, client, redis } = setup();
    provider.completeJson.mockResolvedValue(okResult);
    client.state.enabled = false;
    prisma.aiGeneration.count.mockResolvedValue(5);

    // Con Redis caído el fallback en memoria deja pasar y corta recién en el
    // límite, en vez de rechazar todo (fail-closed).
    for (let i = 0; i < 10; i += 1) {
      await service.generateTaskDraft("ws1", "u1", `Tarea ${i}`);
    }
    expectTooMany(
      await capture(() => service.generateTaskDraft("ws1", "u1", "Una más")),
    );

    expect(provider.completeJson).toHaveBeenCalledTimes(10);
    expect(redis.withFallback).toHaveBeenCalledTimes(11);
  });
});

describe("AiService.getUsage", () => {
  it("cuenta las generaciones de hoy del usuario y devuelve el límite", async () => {
    const { service, prisma } = setup();
    prisma.aiGeneration.count.mockResolvedValue(4);

    const usage = await service.getUsage("ws1", "u1");

    expect(usage).toEqual({ usedToday: 4, dailyLimit: 15 });
    expect(prisma.aiGeneration.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        createdAt: { gte: expect.any(Date) },
      },
    });
  });

  it("valida que el usuario sea miembro del workspace", async () => {
    const { service, access } = setup();
    await service.getUsage("ws1", "u1");
    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
  });
});

describe("AiService.getCapabilities", () => {
  it("reporta el proveedor y el límite cuando hay key", async () => {
    const { service } = setup(true);

    expect(await service.getCapabilities("ws1", "u1")).toEqual({
      configured: true,
      model: "gemini-3.6-flash",
      dailyLimit: 15,
    });
  });

  it("reporta configured:false sin key, en vez de lanzar", async () => {
    // Este es el caso que motivó el endpoint: una instalación sin IA es válida,
    // y el throw de ServiceUnavailable era lo que hacía que la UI dibujara un
    // asistente inservible. Acá se responde el estado, no se falla.
    const { service } = setup(false);

    const caps = await service.getCapabilities("ws1", "u1");

    expect(caps.configured).toBe(false);
    expect(caps.model).toBe("gemini-3.6-flash");
  });

  it("exige membresía: no revela la configuración a un intruso", async () => {
    const { service, access } = setup();
    access.assertMembership.mockRejectedValue(new Error("Forbidden"));

    await expect(service.getCapabilities("ws1", "u1")).rejects.toThrow(
      "Forbidden",
    );
    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
  });

  it("no consulta ni escribe nada en la base", async () => {
    const { service, prisma } = setup();

    await service.getCapabilities("ws1", "u1");

    expect(prisma.aiGeneration.count).not.toHaveBeenCalled();
    expect(prisma.aiGeneration.create).not.toHaveBeenCalled();
  });
});
