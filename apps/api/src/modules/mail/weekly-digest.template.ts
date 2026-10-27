import { emailLayout, escapeHtml } from "./email-layout";

export interface WeeklyDigestTask {
  title: string;
  dueDate: string | null;
}

export interface WeeklyDigestEmailData {
  name: string;
  timeZone: string;
  openCount: number;
  overdueCount: number;
  upcomingCount: number;
  completedCount: number;
  /** Tareas que conviene mirar primero (vencidas o próximas). */
  tasks: WeeklyDigestTask[];
  actionUrl: string;
}

/**
 * Resumen semanal con números reales de la cuenta.
 *
 * El email se manda los lunes a las 8:00 en la zona horaria del usuario. Los
 * conteos salen de `Task` (asignadas a la persona), no de una estimación: un
 * resumen con números inventados es peor que no mandarlo.
 */
export function buildWeeklyDigestEmail(data: WeeklyDigestEmailData): {
  subject: string;
  html: string;
} {
  const stats = [
    { label: "Pendientes", value: data.openCount },
    { label: "Vencidas", value: data.overdueCount },
    { label: "Esta semana", value: data.upcomingCount },
    { label: "Completadas", value: data.completedCount },
  ];

  const statsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      ${stats
        .map(
          (stat) => `<td style="padding:0 4px;text-align:center;">
            <div style="background:#f4f4f5;border-radius:8px;padding:12px 4px;">
              <div style="font-size:22px;font-weight:bold;color:#18181b;">${stat.value}</div>
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(
                stat.label,
              )}</div>
            </div>
          </td>`,
        )
        .join("")}
    </tr>
  </table>`;

  const tasksHtml =
    data.tasks.length === 0
      ? `<p style="margin:0 0 24px;font-size:14px;color:#71717a;">No tenés tareas urgentes esta semana. Buen momento para adelantar algo del backlog.</p>`
      : `<p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#18181b;">Para mirar primero</p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#3f3f46;line-height:1.8;">
          ${data.tasks
            .map(
              (task) =>
                `<li>${escapeHtml(task.title)}${
                  task.dueDate
                    ? ` <span style="color:#a1a1aa;">· ${escapeHtml(
                        dueLabel(task.dueDate, data.timeZone),
                      )}</span>`
                    : ""
                }</li>`,
            )
            .join("")}
        </ul>`;

  return emailLayout({
    subject: "Tu resumen semanal de TaskMaster",
    heading: `Tu semana, ${data.name}`,
    intro:
      data.openCount === 0 && data.completedCount === 0
        ? "No tenés tareas asignadas todavía. Cuando arranques, acá vas a ver tu resumen."
        : `Así viene tu semana: ${data.openCount} ${
            data.openCount === 1 ? "tarea pendiente" : "tareas pendientes"
          } y ${data.completedCount} ${
            data.completedCount === 1 ? "completada" : "completadas"
          } en los últimos 7 días.`,
    bodyHtml: statsHtml + tasksHtml,
    actionLabel: "Ver mi dashboard",
    actionUrl: data.actionUrl,
    footnote:
      "Recibís este resumen porque lo activaste en Ajustes → Notificaciones. Podés desactivarlo cuando quieras.",
  });
}

function dueLabel(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("es", {
      timeZone,
      day: "2-digit",
      month: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("es", {
      day: "2-digit",
      month: "short",
    }).format(date);
  }
}
