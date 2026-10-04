import { Injectable } from "@nestjs/common";
import { TaskStatus, type AgendaReviewQuery } from "@taskmaster/contracts";
import {
  reviewAgenda,
  type AgendaTask as DomainAgendaTask,
} from "@taskmaster/domain";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  /**
   * Diagnóstico de agenda del workspace.
   *
   * Solo lectura de cálculo, sin llamar a un proveedor de IA: la función del
   * dominio es pura y su resultado no depende de que haya `GEMINI_API_KEY`. Por
   * eso este endpoint no se declinea cuando la IA no está configurada.
   */
  async review(
    workspaceId: string,
    userId: string,
    query: AgendaReviewQuery,
    now = new Date(),
  ) {
    await this.access.assertMembership(workspaceId, userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
      },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        startDate: true,
        completedAt: true,
        assignees: { select: { userId: true } },
      },
    });

    // El dominio habla de `assignees: { id }` y la fila de Prisma trae
    // `userId`. Se traduce acá en vez de en el dominio para no atar el cálculo a
    // la forma de la base.
    const domainTasks: DomainAgendaTask[] = tasks.map((task) => ({
      id: task.id,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      startDate: task.startDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      assignees: task.assignees.map((a) => ({ id: a.userId })),
    }));

    const review = reviewAgenda(domainTasks, query, now);

    return { ...review, analyzedTasks: domainTasks.length };
  }
}
