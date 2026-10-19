import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { TagsService } from "./tags.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

function makeTag(overrides: Record<string, unknown> = {}) {
  return {
    id: "tag1",
    workspaceId: WORKSPACE_ID,
    name: "bug",
    color: "#ff0000",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function setup() {
  const findMany = vi.fn().mockResolvedValue([]);
  const findUnique = vi.fn().mockResolvedValue(null);
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn().mockResolvedValue(makeTag());
  const update = vi.fn().mockResolvedValue(makeTag());
  const remove = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    tag: {
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
  const service = new TagsService(prisma as never, access as never);
  return {
    service,
    prisma: { findMany, findUnique, findFirst, create, update, remove },
    access,
  };
}

describe("TagsService", () => {
  it("list exige membresía y ordena por nombre", async () => {
    const { service, prisma, access } = setup();
    prisma.findMany.mockResolvedValue([makeTag()]);

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
    prisma.findUnique.mockResolvedValue(makeTag());

    await expect(
      service.create(WORKSPACE_ID, USER_ID, { name: "bug" } as never),
    ).rejects.toThrow(ConflictException);
    expect(prisma.create).not.toHaveBeenCalled();
  });

  it("create persiste la etiqueta nueva", async () => {
    const { service } = setup();

    const result = await service.create(WORKSPACE_ID, USER_ID, {
      name: "feature",
      color: "#00ff00",
    } as never);

    expect(result.id).toBe("tag1");
  });

  it("update lanza NotFound si no existe", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(null);

    await expect(
      service.update(WORKSPACE_ID, "tag1", USER_ID, { name: "x" } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it("update rechaza el conflicto al renombrar a uno existente", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(makeTag());
    prisma.findUnique.mockResolvedValue(makeTag({ id: "other" }));

    await expect(
      service.update(WORKSPACE_ID, "tag1", USER_ID, { name: "otra" } as never),
    ).rejects.toThrow(ConflictException);
  });

  it("remove borra solo si la etiqueta pertenece al workspace", async () => {
    const { service, prisma } = setup();
    prisma.findFirst.mockResolvedValue(makeTag());

    const result = await service.remove(WORKSPACE_ID, "tag1", USER_ID);

    expect(result).toEqual({ id: "tag1" });
    expect(prisma.remove).toHaveBeenCalledWith({ where: { id: "tag1" } });
  });
});
