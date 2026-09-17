import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CommentsService } from "./comments.service";

function setup(comment: unknown) {
  const prisma = {
    comment: {
      findUnique: vi.fn().mockResolvedValue(comment),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const access = { assertWriteRole: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };
  const notifications = { create: vi.fn() };
  const service = new CommentsService(
    prisma as never,
    access as never,
    events as never,
    notifications as never,
  );
  return { service, prisma };
}

const BASE_COMMENT = {
  id: "c1",
  taskId: "t1",
  userId: "u1",
  body: "hola",
  mentionedUserIds: "[]",
};

describe("CommentsService.update (aislamiento de workspace)", () => {
  it("responde 404 si el comentario pertenece a otro workspace", async () => {
    const { service, prisma } = setup({
      ...BASE_COMMENT,
      task: { workspaceId: "otro" },
    });

    await expect(
      service.update("ws1", "c1", "u1", { body: "editado" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it("consulta el workspace a través de la tarea asociada", async () => {
    const { service, prisma } = setup({
      ...BASE_COMMENT,
      task: { workspaceId: "ws1" },
    });
    prisma.comment.update.mockResolvedValue({
      ...BASE_COMMENT,
      createdAt: new Date(),
      task: { workspaceId: "ws1" },
    });

    await service.update("ws1", "c1", "u1", { body: "editado" });

    expect(prisma.comment.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      include: { task: { select: { workspaceId: true } } },
    });
  });
});

describe("CommentsService.remove (aislamiento de workspace)", () => {
  it("responde 404 si el comentario pertenece a otro workspace", async () => {
    const { service, prisma } = setup({
      ...BASE_COMMENT,
      task: { workspaceId: "otro" },
    });

    await expect(service.remove("ws1", "c1", "u1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });
});
