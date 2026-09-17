import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { describe, expect, it, vi } from "vitest";
import { TimeEntriesService } from "./time-entries.service";

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry1",
    workspaceId: "ws1",
    taskId: "task1",
    userId: "owner",
    description: "trabajo",
    startedAt: new Date("2026-01-01T10:00:00Z"),
    stoppedAt: null,
    duration: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    user: { id: "owner", name: "Owner", avatarUrl: null },
    ...overrides,
  };
}

function setup(role: WorkspaceRole, entry = makeEntry()) {
  const prisma = {
    timeEntry: {
      findUnique: vi.fn().mockResolvedValue(entry),
      update: vi
        .fn()
        .mockResolvedValue(makeEntry({ stoppedAt: new Date(), duration: 60 })),
      delete: vi.fn().mockResolvedValue(entry),
    },
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue({ role }),
    assertRole: vi
      .fn()
      .mockImplementation(
        async (
          _w: string,
          _u: string,
          min: WorkspaceRole,
        ): Promise<{ role: WorkspaceRole }> => {
          const weights: Record<WorkspaceRole, number> = {
            VIEWER: 1,
            MEMBER: 2,
            ADMIN: 3,
            OWNER: 4,
          };
          if (weights[role] < weights[min]) {
            throw new ForbiddenException("No tienes permisos para esta acción");
          }
          return { role };
        },
      ),
  };
  const service = new TimeEntriesService(prisma as never, access as never);
  return { service, prisma, access };
}

describe("TimeEntriesService ownership", () => {
  it("permite al dueño detener su propia entrada", async () => {
    const { service, prisma } = setup(WorkspaceRole.MEMBER);

    await service.stop("ws1", "owner", "entry1");

    expect(prisma.timeEntry.update).toHaveBeenCalled();
  });

  it("bloquea a un MEMBER que intenta detener la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(service.stop("ws1", "owner", "entry1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  it("permite a un ADMIN detener la entrada ajena", async () => {
    const { service } = setup(
      WorkspaceRole.ADMIN,
      makeEntry({ userId: "otro" }),
    );

    await expect(service.stop("ws1", "owner", "entry1")).resolves.toBeDefined();
  });

  it("bloquea a un MEMBER que edita la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(
      service.update("ws1", "owner", "entry1", { description: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  it("bloquea a un MEMBER que elimina la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(
      service.remove("ws1", "owner", "entry1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });

  it("oculta como no encontrada una entrada de otro workspace", async () => {
    const { service } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ workspaceId: "ws2" }),
    );

    await expect(
      service.remove("ws1", "owner", "entry1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
