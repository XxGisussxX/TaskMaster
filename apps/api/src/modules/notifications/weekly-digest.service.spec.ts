import { describe, expect, it, vi } from "vitest";
import { isDigestWindow, WeeklyDigestService } from "./weekly-digest.service";

// Lunes 26/10/2026 a las 08:05 en America/Bogota (UTC-5).
const MONDAY_8_BOGOTA = new Date("2026-10-26T13:05:00.000Z");

function setup(
  options: {
    users?: unknown[];
    tasks?: unknown[];
    completed?: number;
    alreadySent?: boolean;
    mailSent?: boolean;
    lockAcquired?: boolean;
  } = {},
) {
  const unscoped = {
    userSettings: {
      findMany: vi.fn().mockResolvedValue(
        options.users ?? [
          {
            userId: "u1",
            timezone: "America/Bogota",
            user: { email: "u1@test.dev", name: "Ana" },
          },
        ],
      ),
    },
    notification: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.alreadySent ? { id: "n0" } : null),
      create: vi.fn().mockResolvedValue({ id: "n1" }),
    },
    task: {
      findMany: vi.fn().mockResolvedValue(options.tasks ?? []),
      count: vi.fn().mockResolvedValue(options.completed ?? 0),
    },
  };
  const mail = {
    sendWeeklyDigest: vi
      .fn()
      .mockResolvedValue({ sent: options.mailSent ?? true }),
  };
  const client = {
    set: vi
      .fn()
      .mockResolvedValue(options.lockAcquired === false ? null : "OK"),
    del: vi.fn().mockResolvedValue(1),
  };
  const redis = {
    keyPrefix: "taskmaster",
    client,
    withFallback: vi.fn((operation: () => Promise<unknown>) => operation()),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === "WEB_URL" ? "https://app.test" : undefined,
    ),
  };
  const service = new WeeklyDigestService(
    unscoped as never,
    mail as never,
    redis as never,
    config as never,
  );
  return { service, unscoped, mail, client, redis };
}

describe("isDigestWindow", () => {
  it("es lunes a las 8:00 de la zona del usuario", () => {
    expect(isDigestWindow(MONDAY_8_BOGOTA, "America/Bogota")).toBe(true);
  });

  it("no dispara a otra hora", () => {
    expect(
      isDigestWindow(new Date("2026-10-26T14:05:00.000Z"), "America/Bogota"),
    ).toBe(false);
  });

  it("no dispara otro día", () => {
    expect(
      isDigestWindow(new Date("2026-10-27T13:05:00.000Z"), "America/Bogota"),
    ).toBe(false);
  });

  it("cae a UTC si la zona es inválida en vez de romper el cron", () => {
    expect(
      isDigestWindow(new Date("2026-10-26T08:00:00.000Z"), "Zona/Inventada"),
    ).toBe(true);
  });
});

describe("WeeklyDigestService.handleWeeklyDigest", () => {
  it("manda el resumen con números reales y deja la notificación", async () => {
    const { service, unscoped, mail } = setup({
      tasks: [
        {
          id: "t1",
          title: "Vencida",
          dueDate: new Date("2026-10-25T13:00:00.000Z"),
        },
        {
          id: "t2",
          title: "Esta semana",
          dueDate: new Date("2026-10-28T13:00:00.000Z"),
        },
        { id: "t3", title: "Sin fecha", dueDate: null },
      ],
      completed: 4,
    });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "u1@test.dev",
        name: "Ana",
        openCount: 3,
        overdueCount: 1,
        upcomingCount: 1,
        completedCount: 4,
        actionUrl: "https://app.test/dashboard",
      }),
    );
    // El email prioriza vencidas y próximas: la tarea sin fecha no entra en el
    // top, aunque cuente en el total de pendientes.
    expect(mail.sendWeeklyDigest.mock.calls[0]![0].tasks).toEqual([
      expect.objectContaining({ title: "Vencida" }),
      expect.objectContaining({ title: "Esta semana" }),
    ]);
    expect(unscoped.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        type: "WEEKLY_DIGEST",
        body: "3 pendientes · 1 vencidas · 4 completadas",
      }),
    });
  });

  it("no manda nada a quien no está en la ventana horaria", async () => {
    const { service, mail } = setup();

    await service.handleWeeklyDigest(new Date("2026-10-26T20:00:00.000Z"));

    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled();
  });

  it("no repite el resumen si ya se envió esta semana", async () => {
    const { service, mail, unscoped } = setup({
      alreadySent: true,
      tasks: [{ id: "t1", title: "X", dueDate: null }],
    });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled();
    expect(unscoped.notification.create).not.toHaveBeenCalled();
  });

  it("no manda si otra réplica tomó el lock", async () => {
    const { service, mail } = setup({
      lockAcquired: false,
      tasks: [{ id: "t1", title: "X", dueDate: null }],
    });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled();
  });

  it("si el email no salió, libera el lock y no marca el envío", async () => {
    const { service, mail, client, unscoped } = setup({
      mailSent: false,
      tasks: [{ id: "t1", title: "X", dueDate: null }],
    });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).toHaveBeenCalled();
    expect(unscoped.notification.create).not.toHaveBeenCalled();
    expect(client.del).toHaveBeenCalled();
  });

  it("libera el lock cuando el provider no está configurado", async () => {
    const { service, client } = setup({
      mailSent: false,
      tasks: [{ id: "t1", title: "X", dueDate: null }],
    });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(client.del).toHaveBeenCalledWith(
      expect.stringContaining("weekly-digest"),
    );
  });

  it("omite a quien no tiene actividad ni tareas pendientes", async () => {
    const { service, mail } = setup({ tasks: [], completed: 0 });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled();
  });

  it("un error de un usuario no corta el envío del resto", async () => {
    const { service, unscoped, mail } = setup({
      users: [
        {
          userId: "u1",
          timezone: "America/Bogota",
          user: { email: "u1@test.dev", name: "Ana" },
        },
        {
          userId: "u2",
          timezone: "America/Bogota",
          user: { email: "u2@test.dev", name: "Beto" },
        },
      ],
      tasks: [{ id: "t1", title: "X", dueDate: null }],
    });
    mail.sendWeeklyDigest
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ sent: true });

    await service.handleWeeklyDigest(MONDAY_8_BOGOTA);

    expect(mail.sendWeeklyDigest).toHaveBeenCalledTimes(2);
    expect(unscoped.notification.create).toHaveBeenCalledTimes(1);
  });
});
