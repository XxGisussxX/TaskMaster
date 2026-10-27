import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

function setup(
  options: {
    emailPrefs?: Record<string, boolean>;
    user?: unknown;
    mailFails?: boolean;
  } = {},
) {
  const created = {
    id: "n1",
    userId: "u1",
    workspaceId: null,
    type: "REMINDER",
    title: "Llamar a Ana",
    body: "Recordatorio programado",
    data: null,
    readAt: null,
    createdAt: new Date("2026-10-26T13:00:00.000Z"),
  };
  const prisma = {
    notification: {
      create: vi.fn().mockResolvedValue(created),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(
        "user" in options
          ? options.user
          : {
              email: "ana@test.dev",
              settings: { emailPrefs: options.emailPrefs ?? {} },
            },
      ),
    },
  };
  const events = { emit: vi.fn() };
  const mail = {
    sendNotification: options.mailFails
      ? vi.fn().mockRejectedValue(new Error("resend caído"))
      : vi.fn().mockResolvedValue({ sent: true }),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === "WEB_URL" ? "https://app.test" : undefined,
    ),
  };
  const service = new NotificationsService(
    prisma as never,
    events as never,
    mail as never,
    config as never,
  );
  return { service, prisma, events, mail };
}

describe("NotificationsService.create", () => {
  it("manda email de recordatorio por defecto y crea la notificación in-app", async () => {
    const { service, mail, events } = setup();

    const notification = await service.create({
      userId: "u1",
      type: "REMINDER",
      title: "Llamar a Ana",
      body: "Recordatorio programado",
    });

    expect(notification.id).toBe("n1");
    expect(events.emit).toHaveBeenCalledWith("notification.new", {
      userId: "u1",
      notification,
    });
    await vi.waitFor(() => expect(mail.sendNotification).toHaveBeenCalled());
    expect(mail.sendNotification).toHaveBeenCalledWith({
      to: "ana@test.dev",
      title: "Llamar a Ana",
      body: "Recordatorio programado",
      actionUrl: "https://app.test/tasks",
    });
  });

  it("respeta la preferencia apagada del usuario", async () => {
    const { service, mail } = setup({ emailPrefs: { reminders: false } });

    await service.create({
      userId: "u1",
      type: "REMINDER",
      title: "Llamar a Ana",
    });

    // Se le da tiempo al fire-and-forget a resolver antes de afirmar que no pasó.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mail.sendNotification).not.toHaveBeenCalled();
  });

  it("usa la preferencia dueSoon para los vencimientos", async () => {
    const { service, mail } = setup({ emailPrefs: { dueSoon: false } });

    await service.create({
      userId: "u1",
      type: "DUE_SOON",
      title: "Vence mañana",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mail.sendNotification).not.toHaveBeenCalled();
  });

  it("no manda email de tipos que se resuelven dentro de la app", async () => {
    const { service, mail } = setup();

    await service.create({
      userId: "u1",
      type: "MENTION",
      title: "Te mencionaron",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mail.sendNotification).not.toHaveBeenCalled();
  });

  it("si el email falla, la notificación in-app igual se crea", async () => {
    const { service, mail } = setup({ mailFails: true });

    await expect(
      service.create({ userId: "u1", type: "REMINDER", title: "X" }),
    ).resolves.toMatchObject({ id: "n1" });
    await vi.waitFor(() => expect(mail.sendNotification).toHaveBeenCalled());
  });

  it("no rompe si el usuario ya no existe", async () => {
    const { service, mail } = setup({ user: null });

    await expect(
      service.create({ userId: "u1", type: "REMINDER", title: "X" }),
    ).resolves.toMatchObject({ id: "n1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mail.sendNotification).not.toHaveBeenCalled();
  });
});
