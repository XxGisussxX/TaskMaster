import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CustomFieldsService } from "./custom-fields.service";

function setup(values: unknown[] = [], entityFound = true) {
  const prisma = {
    customFieldValue: { findMany: vi.fn().mockResolvedValue(values) },
    task: {
      findFirst: vi
        .fn()
        .mockResolvedValue(entityFound ? { id: "task1" } : null),
      findMany: vi
        .fn()
        .mockResolvedValue(
          entityFound ? [{ id: "task1" }, { id: "task2" }] : [],
        ),
    },
    note: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const access = { assertMembership: vi.fn().mockResolvedValue(undefined) };
  const service = new CustomFieldsService(prisma as never, access as never);
  return { service, prisma };
}

describe("CustomFieldsService.getValues (aislamiento de workspace)", () => {
  it("filtra por el workspace de la definición en la consulta", async () => {
    const { service, prisma } = setup();

    await service.getValues("ws1", "u1", "task", "task1");

    expect(prisma.customFieldValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityId: "task1",
          entityType: "task",
          definition: { workspaceId: "ws1" },
        },
      }),
    );
  });

  it("descarta por defensa valores de definiciones de otro workspace", async () => {
    const { service } = setup([
      {
        id: "v1",
        definitionId: "d1",
        entityId: "task1",
        entityType: "task",
        value: "x",
        createdAt: new Date(),
        definition: {
          id: "d1",
          workspaceId: "otro",
          name: "campo",
          type: "TEXT",
          options: null,
          order: 0,
          required: false,
          createdAt: new Date(),
        },
      },
    ]);

    const result = await service.getValues("ws1", "u1", "task", "task1");

    expect(result).toEqual([]);
  });

  it("rechaza una entidad que no pertenece al workspace", async () => {
    const { service, prisma } = setup([], false);

    await expect(
      service.getValues("ws1", "u1", "task", "ajena"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customFieldValue.findMany).not.toHaveBeenCalled();
  });
});

describe("CustomFieldsService.getValuesForMany (aislamiento de workspace)", () => {
  it("filtra por el workspace de la definición en la consulta", async () => {
    const { service, prisma } = setup();

    await service.getValuesForMany("ws1", "u1", "task", ["task1", "task2"]);

    expect(prisma.customFieldValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: "task",
          entityId: { in: ["task1", "task2"] },
          definition: { workspaceId: "ws1" },
        },
      }),
    );
  });

  it("rechaza si alguna entidad no pertenece al workspace", async () => {
    const { service, prisma } = setup([], false);

    await expect(
      service.getValuesForMany("ws1", "u1", "task", ["task1", "ajena"]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customFieldValue.findMany).not.toHaveBeenCalled();
  });
});
