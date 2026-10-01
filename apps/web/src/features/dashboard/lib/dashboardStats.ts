import {
  Priority,
  TaskStatus,
  type Task,
  type WorkspaceMember,
} from "@taskmaster/contracts";
import { toDate, toLocalDateKey } from "@taskmaster/domain";

export interface WeekSums {
  current: number;
  previous: number;
  changePct: number;
}

/** Lunes 00:00 de la semana que contiene la fecha dada (ISO 8601). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Suma `completed` de la serie diaria para la semana actual y la anterior.
 * Pensado para `DashboardStats.kpiTrends` (ventana de 30 días real).
 */
export function weekCompleted(
  trends: { date: string; completed: number }[],
  now = new Date(),
): WeekSums {
  const thisWeek = startOfWeek(now).getTime();
  const lastWeek = addDays(startOfWeek(now), -7).getTime();
  let current = 0;
  let previous = 0;
  for (const point of trends) {
    const bucket = startOfWeek(toDate(point.date)).getTime();
    if (bucket === thisWeek) current += point.completed;
    else if (bucket === lastWeek) previous += point.completed;
  }
  const changePct =
    previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : current > 0
        ? 100
        : 0;
  return { current, previous, changePct };
}

export function partOfDayGreeting(hour = new Date().getHours()): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function formatLongToday(now = new Date()): string {
  const raw = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isOpen(task: Pick<Task, "status">): boolean {
  return task.status !== TaskStatus.DONE && task.status !== TaskStatus.ARCHIVED;
}

export function isCritical(priority: Priority): boolean {
  return priority === Priority.URGENT || priority === Priority.HIGH;
}

/** Tareas abiertas con fecha límite igual o posterior a hoy, ordenadas por vencimiento. */
export function upcomingDeadlines(
  tasks: Task[],
  now = new Date(),
  limit = 6,
): Task[] {
  const todayKey = toLocalDateKey(toDate(now));
  return tasks
    .filter(
      (task) =>
        task.dueDate &&
        isOpen(task) &&
        toLocalDateKey(toDate(task.dueDate)) >= todayKey,
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
    )
    .slice(0, limit);
}

export interface MemberLoad {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  open: number;
  completed: number;
  currentUser: boolean;
}

export interface TeamLoad {
  members: MemberLoad[];
  unassignedOpen: number;
  totalOpen: number;
  totalCompleted: number;
}

/** Carga real por miembro a partir de tareas y miembros del workspace. */
export function computeTeamLoad(
  tasks: Task[],
  members: Pick<WorkspaceMember, "userId" | "role" | "user">[],
  currentUserId?: string,
): TeamLoad {
  const totalOpen = tasks.filter((t) => isOpen(t)).length;
  const totalCompleted = tasks.filter(
    (t) => t.status === TaskStatus.DONE,
  ).length;

  const byUser = (userId: string) =>
    tasks.filter((t) => t.assignees.some((a) => a.id === userId));

  const loaded: MemberLoad[] = members.map((member) => {
    const assigned = byUser(member.userId);
    return {
      userId: member.userId,
      name: member.user?.name ?? "Miembro",
      avatarUrl: member.user?.avatarUrl ?? null,
      role: member.role,
      open: assigned.filter((t) => isOpen(t)).length,
      completed: assigned.filter((t) => t.status === TaskStatus.DONE).length,
      currentUser: member.userId === currentUserId,
    };
  });

  return {
    members: loaded.sort(
      (a, b) => b.open - a.open || a.name.localeCompare(b.name),
    ),
    unassignedOpen: tasks.filter((t) => t.assignees.length === 0 && isOpen(t))
      .length,
    totalOpen,
    totalCompleted,
  };
}
