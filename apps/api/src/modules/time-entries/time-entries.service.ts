import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WorkspaceRole } from "@taskmaster/contracts";
import type {
  CreateTimeEntryInput,
  PaginatedTimeEntries,
  TimeEntry,
  TimeEntryTotalsQuery,
  TimeEntryTotalsReport,
  UpdateTimeEntryInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

/**
 * Forma de la fila que devuelve Prisma al listar con el `include` de usuario
 * que usan los queries de este servicio. Se declara a mano porque el `include`
 * se infiere en el call site y `ReturnType` no lo ve.
 */
type TimeEntryRow = {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  description: string;
  startedAt: Date;
  stoppedAt: Date | null;
  duration: number | null;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null } | null;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Ventana por defecto y tope del filtro de time-entries.
 *
 * El listado y el reporte de totales exigen un rango para no barrer el
 * histórico completo (200k filas en el bench). Si el cliente no manda `from/to`
 * se asume el último mes, y una ventana mayor a un año se recorta: es el máximo
 * "razonable" para no materializar un rango arbitrario desde el query string.
 * Se aplica en el servicio (no en el schema) para no romper a los clientes
 * actuales que aún no mandan rango.
 */
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  /**
   * Normaliza el rango del filtro: `to` por defecto ahora, `from` por defecto
   * 30 días atrás, y una ventana que exceda {@link MAX_RANGE_DAYS} se recorta
   * moviendo `from` hacia adelante (nunca `to`, que sería mover el "presente").
   */
  private normalizeRange(filters: { from?: Date; to?: Date }): {
    from: Date;
    to: Date;
  } {
    const to = filters.to ?? new Date();
    let from =
      filters.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
    const maxSpanMs = MAX_RANGE_DAYS * 86_400_000;
    if (to.getTime() - from.getTime() > maxSpanMs) {
      from = new Date(to.getTime() - maxSpanMs);
    }
    if (from.getTime() > to.getTime()) from = to;
    return { from, to };
  }

  private toTimeEntry(entry: TimeEntryRow): TimeEntry {
    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      taskId: entry.taskId,
      userId: entry.userId,
      description: entry.description,
      startedAt: entry.startedAt.toISOString(),
      stoppedAt: entry.stoppedAt?.toISOString() ?? null,
      duration: entry.duration,
      user: entry.user ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateTimeEntryInput,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: input.taskId, workspaceId },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    const startedAt = new Date(input.startedAt);
    const stoppedAt = input.stoppedAt ? new Date(input.stoppedAt) : null;

    const duration = stoppedAt
      ? Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    const entry = await this.prisma.timeEntry.create({
      data: {
        workspaceId,
        taskId: input.taskId,
        userId,
        description: input.description ?? "",
        startedAt,
        stoppedAt,
        duration,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return this.toTimeEntry(entry);
  }

  async list(
    workspaceId: string,
    userId: string,
    filters: {
      taskId?: string;
      userId?: string;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ): Promise<PaginatedTimeEntries> {
    await this.access.assertMembership(workspaceId, userId);

    const { from, to } = this.normalizeRange(filters);

    const where: Record<string, unknown> = {
      workspaceId,
      startedAt: { gte: from, lte: to },
    };

    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.userId) where.userId = filters.userId;

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);

    const [entries, totals] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.timeEntry.aggregate({
        where,
        _count: true,
        _sum: { duration: true },
      }),
    ]);

    const total = totals._count;

    return {
      items: entries.map((e) => this.toTimeEntry(e)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totals: { count: total, durationSeconds: totals._sum.duration ?? 0 },
    };
  }

  /**
   * Totales de horas agrupados por tarea, persona o semana.
   *
   * Agrega en PostgreSQL (nunca materializa las filas): usa el índice
   * `TimeEntry [workspaceId, startedAt]` para el rango y hace el `GROUP BY`
   * server-side. Respeta los mismos filtros que {@link list} y el mismo rango
   * normalizado (con `from/to` por defecto y tope de ventana).
   */
  async totals(
    workspaceId: string,
    userId: string,
    query: TimeEntryTotalsQuery,
  ): Promise<TimeEntryTotalsReport> {
    await this.access.assertMembership(workspaceId, userId);

    const { from, to } = this.normalizeRange(query);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`te."workspaceId" = ${workspaceId}`,
      Prisma.sql`te."startedAt" >= ${from}`,
      Prisma.sql`te."startedAt" <= ${to}`,
    ];
    if (query.taskId)
      conditions.push(Prisma.sql`te."taskId" = ${query.taskId}`);
    if (query.userId)
      conditions.push(Prisma.sql`te."userId" = ${query.userId}`);
    const where = Prisma.sql`${Prisma.join(conditions, " AND ")}`;

    type TotalRow = {
      key: string;
      label: string | null;
      count: number;
      total: number;
    };
    let rows: TotalRow[];
    if (query.groupBy === "user") {
      rows = await this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
        SELECT te."userId" AS key, u."name" AS label,
          COUNT(*)::int AS count,
          COALESCE(SUM(te."duration"), 0)::int AS total
        FROM "TimeEntry" te
        LEFT JOIN "User" u ON u."id" = te."userId"
        WHERE ${where}
        GROUP BY 1, 2
        ORDER BY total DESC, key ASC`);
    } else if (query.groupBy === "week") {
      rows = await this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
        SELECT to_char(date_trunc('week', te."startedAt"), 'IYYY-"W"IW') AS key,
          NULL::text AS label,
          COUNT(*)::int AS count,
          COALESCE(SUM(te."duration"), 0)::int AS total
        FROM "TimeEntry" te
        WHERE ${where}
        GROUP BY 1
        ORDER BY 1 ASC`);
    } else {
      rows = await this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
        SELECT te."taskId" AS key, t."title" AS label,
          COUNT(*)::int AS count,
          COALESCE(SUM(te."duration"), 0)::int AS total
        FROM "TimeEntry" te
        LEFT JOIN "Task" t ON t."id" = te."taskId"
        WHERE ${where}
        GROUP BY 1, 2
        ORDER BY total DESC, key ASC`);
    }

    const groups = rows.map((row) => ({
      key: row.key,
      label: row.label ?? null,
      count: Number(row.count),
      durationSeconds: Number(row.total),
    }));

    return {
      groupBy: query.groupBy,
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        count: groups.reduce((acc, g) => acc + g.count, 0),
        durationSeconds: groups.reduce((acc, g) => acc + g.durationSeconds, 0),
      },
      groups,
    };
  }

  async stop(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }
    await this.assertEntryOwnerOrAdmin(workspaceId, userId, existing.userId);

    const stoppedAt = new Date();
    const duration = Math.floor(
      (stoppedAt.getTime() - existing.startedAt.getTime()) / 1000,
    );

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: { stoppedAt, duration },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return this.toTimeEntry(entry);
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateTimeEntryInput,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }
    await this.assertEntryOwnerOrAdmin(workspaceId, userId, existing.userId);

    const data: Record<string, unknown> = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.startedAt !== undefined)
      data.startedAt = new Date(input.startedAt);
    if (input.stoppedAt !== undefined) {
      data.stoppedAt = input.stoppedAt ? new Date(input.stoppedAt) : null;
    }

    const startedAt =
      data.startedAt instanceof Date ? data.startedAt : existing.startedAt;
    const stoppedAt =
      data.stoppedAt instanceof Date
        ? data.stoppedAt
        : data.stoppedAt === null
          ? null
          : existing.stoppedAt;

    if (stoppedAt) {
      data.duration = Math.floor(
        (stoppedAt.getTime() - startedAt.getTime()) / 1000,
      );
    } else {
      data.duration = null;
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return this.toTimeEntry(entry);
  }

  async remove(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }
    await this.assertEntryOwnerOrAdmin(workspaceId, userId, existing.userId);

    await this.prisma.timeEntry.delete({ where: { id } });
    return { id };
  }

  private async assertEntryOwnerOrAdmin(
    workspaceId: string,
    userId: string,
    entryUserId: string,
  ): Promise<void> {
    if (entryUserId === userId) return;
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);
  }
}
