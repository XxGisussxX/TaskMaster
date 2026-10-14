import { Injectable } from "@nestjs/common";
import { TaskStatus, type AgendaReviewQuery } from "@taskmaster/contracts";
import {
  reviewAgenda,
  type AgendaTask as DomainAgendaTask,
} from "@taskmaster/domain";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

/**
 * Tope de tareas abiertas que entran al análisis.
 *
 * La revisión es O(n²) en el peor caso (solapas del mismo responsable), así que
 * aun con el tope de hallazgos del dominio el barrido necesita un techo. Se
 * ordenan por vencimiento (las que vencen antes importan más) y se pide una fila
 * de más para saber si había más: si llegó la de más, la revisión se marca
 * `truncated` y se descarta. El límite queda documentado en la respuesta
 * (`analyzedTasks` y `truncated`).
 */
const MAX_AGENDA_TASKS = 5000;

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

    const fetched = await this.prisma.task.findMany({
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
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: MAX_AGENDA_TASKS + 1,
    });

    const tasksTruncated = fetched.length > MAX_AGENDA_TASKS;
    const tasks = tasksTruncated ? fetched.slice(0, MAX_AGENDA_TASKS) : fetched;

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

    return {
      ...review,
      analyzedTasks: domainTasks.length,
      // El tope de tareas y el tope de hallazgos del dominio son causas
      // distintas de truncado; la UI solo necesita saber que el informe está
      // incompleto.
      ...(tasksTruncated ? { truncated: true } : {}),
    };
  }
}
