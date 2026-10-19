import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ChannelsService } from "./channels.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

function makeChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "ch1",
    workspaceId: WORKSPACE_ID,
    name: "General",
    color: "#3b82f6",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function setup() {
  const findMany = vi.fn().mockResolvedValue([]);
  const findUnique = vi.fn().mockResolvedValue(null);
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn().mockResolvedValue(makeChannel());
  const update = vi.fn().mockResolvedValue(makeChannel());
  const remove = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    channel: {
      findMany,
      findUnique,
      findFirst,
      create,
      update,
      delete: remove,
    },
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue(undefined),
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ChannelsService(prisma as never, access as never);
  return {
    service,
    prisma: { findMany, findUnique, findFirst, create, update, remove },
    access,
  };
}

describe("ChannelsService", () => {
  it("list exige membresía y ordena por nombre", async () => {
    const { service, prisma, access } = setup();
    prisma.findMany.mockResolvedValue([makeChannel()]);

    const result = await service.list(WORKSPACE_ID, USER_ID);

    expect(access.assertMembership).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID);
    expect(result[0]!.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(prisma.findMany).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { name: "asc" },
    });
  });

  it("create rechaza un nombre duplicado en el workspace", async () => {
    const { service, prisma } = setup();
    prisma.findUnique.mockResolvedValue(makeChannel());

    await expect(
      service.create(WORKSPACE_ID, USER_ID, { name: "General" } as never),
    ).rejects.toThrow(ConflictException);
    expect(prisma.create).not.toHaveBeenCalled();
  });

  it("update lanza NotFound si no existe", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(null);

    await expect(
      service.update(WORKSPACE_ID, "ch1", USER_ID, { name: "x" } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it("update rechaza el conflicto al renombrar a uno existente", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(makeChannel());
    prisma.findUnique.mockResolvedValue(makeChannel({ id: "other" }));

    await expect(
      service.update(WORKSPACE_ID, "ch1", USER_ID, { name: "Otro" } as never),
    ).rejects.toThrow(ConflictException);
  });

  it("remove borra solo si el canal pertenece al workspace", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(makeChannel());

    const result = await service.remove(WORKSPACE_ID, "ch1", USER_ID);

    expect(result).toEqual({ id: "ch1" });
    expect(prisma.remove).toHaveBeenCalledWith({ where: { id: "ch1" } });
  });
});
