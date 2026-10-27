import { emailLayout } from "./email-layout";

export interface NotificationEmailData {
  title: string;
  body?: string;
  actionUrl: string;
}

/**
 * Email de una notificación in-app (recordatorio o tarea por vencer).
 *
 * No duplica el detalle de la notificación: `title` y `body` ya vienen armados
 * por el servicio que la creó, así que el email cuenta exactamente lo mismo que
 * la campanita. Si el body falta, se usa una frase genérica para que el correo
 * no salga con un hueco.
 */
export function buildNotificationEmail(data: NotificationEmailData): {
  subject: string;
  html: string;
} {
  return emailLayout({
    subject: data.title,
    heading: data.title,
    intro: data.body?.trim() || "Tenés una novedad en TaskMaster.",
    actionLabel: "Abrir TaskMaster",
    actionUrl: data.actionUrl,
    footnote:
      "Recibís este correo porque tenés las notificaciones por email activadas. Podés desactivarlas desde Ajustes.",
  });
}
