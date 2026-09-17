import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateTaskDependencyInput,
  TaskDependency,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class TaskDependenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    input: CreateTaskDependencyInput,
  ): Promise<TaskDependency> {
    await this.access.assertWriteRole(workspaceId, userId);

    const { fromTaskId, toTaskId } = input;

    if (fromTaskId === toTaskId) {
      throw new BadRequestException("Una tarea no puede depender de sÃ­ misma");
    }

    const [fromTask, toTask] = await Promise.all([
      this.prisma.task.findFirst({
        where: { id: fromTaskId, workspaceId },
      }),
      this.prisma.task.findFirst({
        where: { id: toTaskId, workspaceId },
      }),
    ]);

    if (!fromTask) {
      throw new NotFoundException("Tarea origen no encontrada");
    }
    if (!toTask) {
      throw new NotFoundException("Tarea destino no encontrada");
    }

    const existing = await this.prisma.taskDependency.findUnique({
      where: { fromTaskId_toTaskId: { fromTaskId, toTaskId } },
    });

    if (existing) {
      throw new ConflictException("Esta dependencia ya existe");
    }

    const hasCycle = await this.detectCycle(workspaceId, fromTaskId, toTaskId);
    if (hasCycle) {
      throw new BadRequestException(
        "Esta dependencia crearÃ­a un ciclo en el grafo de dependencias",
      );
    }

    const dep = await this.prisma.taskDependency.create({
      data: { workspaceId, fromTaskId, toTaskId },
      include: {
        fromTask: {
          select: { id: true, title: true, status: true, priority: true },
        },
        toTask: {
          select: { id: true, title: true, status: true, priority: true },
        },
      },
    });

    return {
      id: dep.id,
      workspaceId: dep.workspaceId,
      fromTaskId: dep.fromTaskId,
      toTaskId: dep.toTaskId,
      fromTask: dep.fromTask,
      toTask: dep.toTask,
      createdAt: dep.createdAt.toISOString(),
    };
  }

  async listByTask(
    workspaceId: string,
    userId: string,
    taskId: string,
  ): Promise<TaskDependency[]> {
    await this.access.assertMembership(workspaceId, userId);

    const deps = await this.prisma.taskDependency.findMany({
      where: {
        workspaceId,
        OR: [{ fromTaskId: taskId }, { toTaskId: taskId }],
      },
      include: {
        fromTask: {
          select: { id: true, title: true, status: true, priority: true },
        },
        toTask: {
          select: { id: true, title: true, status: true, priority: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return deps.map((d) => ({
      id: d.id,
      workspaceId: d.workspaceId,
      fromTaskId: d.fromTaskId,
      toTaskId: d.toTaskId,
      fromTask: d.fromTask,
      toTask: d.toTask,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async remove(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.taskDependency.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException("Dependencia no encontrada");
    }

    await this.prisma.taskDependency.delete({ where: { id } });
    return { id };
  }

  private async detectCycle(
    workspaceId: string,
    fromTaskId: string,
    toTaskId: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [toTaskId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const blockedByDeps = await this.prisma.taskDependency.findMany({
        where: { toTaskId: current, workspaceId },
        select: { fromTaskId: true },
      });

      for (const dep of blockedByDeps) {
        if (!visited.has(dep.fromTaskId)) {
          queue.push(dep.fromTaskId);
        }
      }
    }

    return false;
  }
}
