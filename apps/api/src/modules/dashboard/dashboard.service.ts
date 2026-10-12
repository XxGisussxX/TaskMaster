import { Injectable } from "@nestjs/common";
import {
  Priority,
  TaskStatus,
  WorkspaceRole,
  type DashboardQuery,
  type DashboardStats,
} from "@taskmaster/contracts";
import { Prisma } from "@prisma/client";
import { toLocalDateKey } from "@taskmaster/domain";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ActivityService } from "../activity/activity.service";

/** Ventana por defecto de las series: hoy y los 29 días previos. */
const DEFAULT_RANGE_DAYS = 30;

interface DailyRow {
  d: string;
  c: number;
}
interface AvgRow {
  d: string;
  s: number | null;
  c: number;
}
interface IdxRow {
  idx: number;
  c: number;
}

function parseLocalDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Acumula un array de diferencias y devuelve el prefijo en cada día. */
function prefix(deltas: number[]): number[] {
  let running = 0;
  return deltas.map((delta) => (running += delta));
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly activity: ActivityService,
  ) {}

  async stats(
    workspaceId: string,
    userId: string,
    query: DashboardQuery = {},
  ): Promise<DashboardStats> {
    const member = await this.access.assertMembership(workspaceId, userId);
    const canSeePeople =
      member.role === WorkspaceRole.ADMIN ||
      member.role === WorkspaceRole.OWNER;

    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const to = query.to ?? toLocalDateKey(now);
    const toDate = parseLocalDate(to);
    const from = query.from ?? this.defaultFrom(toDate);
    const year = query.year ?? now.getFullYear();

    const days = this.dayKeys(from, to);
    const n = days.length;

    // Expresión SQL reutilizable: día calendario local de una columna UTC.
    const dayOf = (column: string): Prisma.Sql =>
      Prisma.sql`((${Prisma.raw(`"${column}"`)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date`;
    const todayExpr = Prisma.sql`${now}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz}`;
    const today = Prisma.sql`(${todayExpr})::date`;

    const [
      statusRows,
      priorityRows,
      kpiRows,
      createdRows,
      completedRows,
      avgRows,
      activeStartRows,
      activeEndRows,
      overdueStartRows,
      overdueEndRows,
      overdueAgeRows,
      heatmapRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ status: string; count: number }[]>(Prisma.sql`
        SELECT "status", COUNT(*)::int AS count FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
        GROUP BY "status"`),
      this.prisma.$queryRaw<{ priority: string; count: number }[]>(Prisma.sql`
        SELECT "priority", COUNT(*)::int AS count FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
        GROUP BY "priority"`),
      this.prisma.$queryRaw<
        {
          total: number;
          done: number;
          completed_today: number;
          avg_days: number | null;
          overdue: number;
        }[]
      >(Prisma.sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "status" = 'DONE')::int AS done,
          COUNT(*) FILTER (
            WHERE "status" = 'DONE' AND "completedAt" IS NOT NULL
              AND ${dayOf("completedAt")} = ${today}
          )::int AS completed_today,
          AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400) FILTER (
            WHERE "status" = 'DONE' AND "completedAt" IS NOT NULL
              AND "completedAt" >= "createdAt"
          ) AS avg_days,
          COUNT(*) FILTER (
            WHERE "dueDate" IS NOT NULL AND "status" <> 'DONE'
              AND ${dayOf("dueDate")} < ${today}
          )::int AS overdue
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'`),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT to_char(${dayOf("createdAt")}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
          AND ${dayOf("createdAt")} BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1`),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT to_char(${dayOf("completedAt")}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" = 'DONE'
          AND "completedAt" IS NOT NULL
          AND ${dayOf("completedAt")} BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1`),
      this.prisma.$queryRaw<AvgRow[]>(Prisma.sql`
        SELECT to_char(${dayOf("completedAt")}, 'YYYY-MM-DD') AS d,
          SUM(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400) AS s,
          COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" = 'DONE'
          AND "completedAt" IS NOT NULL AND "completedAt" >= "createdAt"
          AND ${dayOf("completedAt")} BETWEEN ${from}::date AND ${to}::date
        GROUP BY 1`),
      // Deltas del KPI "activas": +1 al crear, -1 al completar, con los guardas
      // que replica `buildKpiTrends` (fin = 0 si DONE sin completar o completada
      // antes de la ventana; fin = n si completada después de la ventana).
      this.prisma.$queryRaw<IdxRow[]>(Prisma.sql`
        SELECT CASE WHEN ${dayOf("createdAt")} < ${from}::date THEN 0
                    ELSE ${dayOf("createdAt")} - ${from}::date END AS idx,
               COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
          AND ${dayOf("createdAt")} <= ${to}::date
          AND (
            "status" <> 'DONE'
            OR ("completedAt" IS NOT NULL AND ${dayOf("completedAt")} > ${to}::date)
            OR ("completedAt" IS NOT NULL
                AND ${dayOf("completedAt")} > ${from}::date
                AND ${dayOf("completedAt")} <= ${to}::date
                AND (${dayOf("createdAt")} < ${from}::date
                     OR ${dayOf("createdAt")} < ${dayOf("completedAt")}))
          )
        GROUP BY 1`),
      this.prisma.$queryRaw<IdxRow[]>(Prisma.sql`
        SELECT ${dayOf("completedAt")} - ${from}::date AS idx, COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" = 'DONE'
          AND "completedAt" IS NOT NULL
          AND ${dayOf("createdAt")} <= ${to}::date
          AND ${dayOf("completedAt")} > ${from}::date
          AND ${dayOf("completedAt")} <= ${to}::date
          AND (${dayOf("createdAt")} < ${from}::date
               OR ${dayOf("createdAt")} < ${dayOf("completedAt")})
        GROUP BY 1`),
      // Deltas del KPI "vencidas": +1 el día siguiente al vencimiento, -1 al
      // completar (solo DONE), con los guardas de `buildKpiTrends`.
      this.prisma.$queryRaw<IdxRow[]>(Prisma.sql`
        SELECT CASE WHEN ${dayOf("dueDate")} < ${from}::date THEN 0
                    ELSE ${dayOf("dueDate")} - ${from}::date + 1 END AS idx,
               COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
          AND "dueDate" IS NOT NULL
          AND ${dayOf("createdAt")} <= ${to}::date
          AND ${dayOf("dueDate")} <= ${to}::date
          AND (
            "status" <> 'DONE'
            OR ("completedAt" IS NOT NULL AND ${dayOf("completedAt")} > ${to}::date)
            OR ("completedAt" IS NOT NULL
                AND ${dayOf("completedAt")} > ${from}::date
                AND ${dayOf("completedAt")} <= ${to}::date
                AND (${dayOf("dueDate")} < ${from}::date
                     OR ${dayOf("dueDate")} < ${dayOf("completedAt")}))
          )
        GROUP BY 1`),
      this.prisma.$queryRaw<IdxRow[]>(Prisma.sql`
        SELECT ${dayOf("completedAt")} - ${from}::date AS idx, COUNT(*)::int AS c
        FROM "Task"
        WHERE "workspaceId" = ${workspaceId} AND "status" = 'DONE'
          AND "completedAt" IS NOT NULL AND "dueDate" IS NOT NULL
          AND ${dayOf("createdAt")} <= ${to}::date
          AND ${dayOf("dueDate")} <= ${to}::date
          AND ${dayOf("completedAt")} > ${from}::date
          AND ${dayOf("completedAt")} <= ${to}::date
          AND (${dayOf("dueDate")} < ${from}::date
               OR ${dayOf("dueDate")} < ${dayOf("completedAt")})
        GROUP BY 1`),
      this.prisma.$queryRaw<
        { b1: number; b2: number; b3: number; b4: number }[]
      >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE age_days BETWEEN 1 AND 7)::int AS b1,
          COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 30)::int AS b2,
          COUNT(*) FILTER (WHERE age_days BETWEEN 31 AND 90)::int AS b3,
          COUNT(*) FILTER (WHERE age_days > 90)::int AS b4
        FROM (
          SELECT (${today} - ${dayOf("dueDate")}) AS age_days
          FROM "Task"
          WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
            AND "status" <> 'DONE' AND "dueDate" IS NOT NULL
            AND ${dayOf("dueDate")} < ${today}
        ) overdue`),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT to_char(${dayOf("coalesced")}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM (
          SELECT COALESCE("completedAt", "createdAt") AS "coalesced"
          FROM "Task"
          WHERE "workspaceId" = ${workspaceId} AND "status" <> 'ARCHIVED'
        ) heat
        WHERE EXTRACT(YEAR FROM ${dayOf("coalesced")}) = ${year}
        GROUP BY 1`),
    ]);

    // --- KPIs y distribuciones -------------------------------------------
    const kpi = kpiRows[0] ?? {
      total: 0,
      done: 0,
      completed_today: 0,
      avg_days: 0,
      overdue: 0,
    };
    const avgDays = kpi.avg_days === null ? 0 : Number(kpi.avg_days);

    const statusDistribution = this.zeroed<TaskStatus>(
      Object.values(TaskStatus),
    );
    for (const row of statusRows) {
      statusDistribution[row.status as TaskStatus] = Number(row.count);
    }
    const priorityDistribution = this.zeroed<Priority>(Object.values(Priority));
    for (const row of priorityRows) {
      priorityDistribution[row.priority as Priority] = Number(row.count);
    }

    const kpis = {
      activeTasks: kpi.total - kpi.done,
      completedToday: Number(kpi.completed_today),
      overdueTasks: Number(kpi.overdue),
      avgCompletionDays: Math.round(avgDays * 10) / 10,
      completionRate:
        kpi.total > 0 ? Math.round((kpi.done / kpi.total) * 100) : 0,
    };

    // --- Series diarias ---------------------------------------------------
    const created = this.byDay(createdRows);
    const completed = this.byDay(completedRows);
    const avgByDay = new Map<string, { s: number; c: number }>();
    for (const row of avgRows) {
      avgByDay.set(row.d, { s: Number(row.s ?? 0), c: Number(row.c) });
    }

    const createdCompletedSeries = days.map((date) => ({
      date,
      created: created.get(date) ?? 0,
      completed: completed.get(date) ?? 0,
    }));

    const activeDelta = new Array<number>(n).fill(0);
    for (const row of activeStartRows) {
      if (row.idx >= 0 && row.idx < n)
        activeDelta[row.idx] = (activeDelta[row.idx] ?? 0) + Number(row.c);
    }
    for (const row of activeEndRows) {
      if (row.idx >= 0 && row.idx < n)
        activeDelta[row.idx] = (activeDelta[row.idx] ?? 0) - Number(row.c);
    }
    const active = prefix(activeDelta);

    const overdueDelta = new Array<number>(n).fill(0);
    for (const row of overdueStartRows) {
      if (row.idx >= 0 && row.idx < n)
        overdueDelta[row.idx] = (overdueDelta[row.idx] ?? 0) + Number(row.c);
    }
    for (const row of overdueEndRows) {
      if (row.idx >= 0 && row.idx < n)
        overdueDelta[row.idx] = (overdueDelta[row.idx] ?? 0) - Number(row.c);
    }
    const overdue = prefix(overdueDelta);

    const kpiTrends = days.map((date, i) => {
      const avg = avgByDay.get(date);
      return {
        date,
        active: active[i] ?? 0,
        completed: completed.get(date) ?? 0,
        overdue: overdue[i] ?? 0,
        avgCompletionDays:
          avg && avg.c > 0 ? Math.round((avg.s / avg.c) * 10) / 10 : 0,
      };
    });

    // --- Throughput semanal (lunes como inicio) ---------------------------
    const weekly = new Map<string, { created: number; completed: number }>();
    for (const date of days) {
      const week = this.weekStart(date);
      const bucket = weekly.get(week) ?? { created: 0, completed: 0 };
      bucket.created += created.get(date) ?? 0;
      bucket.completed += completed.get(date) ?? 0;
      weekly.set(week, bucket);
    }
    const weeklyThroughput = [...weekly.entries()].map(([weekStart, v]) => ({
      weekStart,
      created: v.created,
      completed: v.completed,
    }));

    // --- Heatmap anual ----------------------------------------------------
    const heatmapMap = new Map(heatmapRows.map((r) => [r.d, Number(r.c)]));
    const heatmap: { date: string; count: number }[] = [];
    const cursor = new Date(year, 0, 1);
    while (cursor.getFullYear() === year) {
      const key = toLocalDateKey(cursor);
      heatmap.push({ date: key, count: heatmapMap.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // --- Vencidas por antigüedad -----------------------------------------
    const age = overdueAgeRows[0] ?? { b1: 0, b2: 0, b3: 0, b4: 0 };
    const overdueByAge = [
      { bucket: "1-7", count: Number(age.b1) },
      { bucket: "8-30", count: Number(age.b2) },
      { bucket: "31-90", count: Number(age.b3) },
      { bucket: "90+", count: Number(age.b4) },
    ];

    // --- Carga y horas por persona (solo ADMIN/OWNER) --------------------
    let workloadByPerson:
      | {
          userId: string;
          name: string;
          activeTasks: number;
          overdueTasks: number;
        }[]
      | undefined;
    let hoursByPerson:
      { userId: string; name: string; seconds: number }[] | undefined;

    if (canSeePeople) {
      const [workloadRows, hoursRows] = await Promise.all([
        this.prisma.$queryRaw<
          {
            userId: string;
            name: string;
            active: number;
            overdue: number;
          }[]
        >(Prisma.sql`
          SELECT ta."userId" AS "userId", u."name" AS name,
            COUNT(*) FILTER (WHERE t."status" <> 'DONE')::int AS active,
            COUNT(*) FILTER (
              WHERE t."status" <> 'DONE' AND t."dueDate" IS NOT NULL
                AND (t."dueDate" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date < ${today}
            )::int AS overdue
          FROM "TaskAssignee" ta
          JOIN "Task" t ON t."id" = ta."taskId"
          JOIN "User" u ON u."id" = ta."userId"
          WHERE t."workspaceId" = ${workspaceId} AND t."status" <> 'ARCHIVED'
          GROUP BY 1, 2
          ORDER BY active DESC`),
        this.prisma.$queryRaw<
          { userId: string; name: string; seconds: number }[]
        >(Prisma.sql`
          SELECT te."userId" AS "userId", u."name" AS name,
            COALESCE(SUM(te."duration"), 0)::int AS seconds
          FROM "TimeEntry" te
          JOIN "User" u ON u."id" = te."userId"
          WHERE te."workspaceId" = ${workspaceId}
          GROUP BY 1, 2
          ORDER BY seconds DESC`),
      ]);
      workloadByPerson = workloadRows.map((r) => ({
        userId: r.userId,
        name: r.name,
        activeTasks: Number(r.active),
        overdueTasks: Number(r.overdue),
      }));
      hoursByPerson = hoursRows.map((r) => ({
        userId: r.userId,
        name: r.name,
        seconds: Number(r.seconds),
      }));
    }

    const activity = await this.activity.list(workspaceId, 30);

    return {
      kpis,
      kpiTrends,
      createdCompletedSeries,
      priorityDistribution,
      statusDistribution,
      activity,
      range: { from, to },
      heatmap,
      weeklyThroughput,
      overdueByAge,
      ...(canSeePeople ? { workloadByPerson, hoursByPerson } : {}),
    };
  }

  private defaultFrom(to: Date): string {
    const from = new Date(to);
    from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1));
    return toLocalDateKey(from);
  }

  private dayKeys(from: string, to: string): string[] {
    const days: string[] = [];
    const cursor = parseLocalDate(from);
    const last = parseLocalDate(to);
    while (cursor.getTime() <= last.getTime()) {
      days.push(toLocalDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  private weekStart(key: string): string {
    const date = parseLocalDate(key);
    const day = (date.getDay() + 6) % 7; // lunes = 0
    date.setDate(date.getDate() - day);
    return toLocalDateKey(date);
  }

  private byDay(rows: DailyRow[]): Map<string, number> {
    return new Map(rows.map((r) => [r.d, Number(r.c)]));
  }

  private zeroed<K extends string>(keys: K[]): Record<K, number> {
    return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  }
}
