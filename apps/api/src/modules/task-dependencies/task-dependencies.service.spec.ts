import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TaskDependenciesService } from "./task-dependencies.service";

function setup(taskFound = true, deps: unknown[] = []) {
  const prisma = {
    task: {
      findFirst: vi.fn().mockResolvedValue(taskFound ? { id: "task1" } : null),
    },
    taskDependency: { findMany: vi.fn().mockResolvedValue(deps) },
  };
  const access = { assertMembership: vi.fn().mockResolvedValue(undefined) };
  const service = new TaskDependenciesService(prisma as never, access as never);
  return { service, prisma };
}

describe("TaskDependenciesService.listByTask", () => {
  it("valida que la tarea pertenezca al workspace antes de consultar", async () => {
    const { service, prisma } = setup();

    await service.listByTask("ws1", "u1", "task1");

    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task1", workspaceId: "ws1" },
      select: { id: true },
    });
    expect(prisma.taskDependency.findMany).toHaveBeenCalled();
  });

  it("rechaza una tarea ajena al workspace", async () => {
    const { service, prisma } = setup(false);

    await expect(
      service.listByTask("ws1", "u1", "ajena"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.taskDependency.findMany).not.toHaveBeenCalled();
  });
});
