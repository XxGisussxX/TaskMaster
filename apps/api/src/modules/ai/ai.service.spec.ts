import { describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AiProviderError } from "./ai.types";
import { AiService } from "./ai.service";

function setup(configured = true) {
  const prisma = {
    tag: {
      findMany: vi.fn().mockResolvedValue([
        { id: "tag-1", name: "Urgente" },
        { id: "tag-2", name: "Cliente" },
      ]),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([{ id: "cat-1", name: "Trabajo" }]),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aiGeneration: {
      create: vi.fn().mockResolvedValue({ id: "g1" }),
      count: vi.fn().mockResolvedValue(3),
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
  const service = new AiService(
    prisma as never,
    access as never,
    provider as never,
    config as never,
  );
  return { service, prisma, access, provider, config };
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

  it("consulta tags y categorías del workspace para el contexto", async () => {
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
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws1" },
      select: { id: true, name: true },
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
        categoryId: "cat-inexistente",
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

    expect(draft.categoryId).toBeNull();
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

  it("respeta los ids válidos de categorías", async () => {
    const { service, provider } = setup();
    provider.completeJson.mockResolvedValue({
      data: {
        title: "Tarea",
        description: "",
        categoryId: "cat-1",
        tagIds: [],
        subtasks: [],
      },
      latencyMs: 10,
      inputChars: 5,
      outputChars: 5,
    });

    const draft = await service.generateTaskDraft("ws1", "u1", "Tarea");

    expect(draft.categoryId).toBe("cat-1");
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
});

describe("AiService.límite diario (gate en memoria)", () => {
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
