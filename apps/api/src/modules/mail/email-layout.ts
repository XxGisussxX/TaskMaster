/**
 * Layout compartido de los emails transaccionales.
 *
 * Se usa `table` + estilos inline a propósito: los clientes de correo (Gmail,
 * Outlook, Apple Mail) ignoran gran parte del CSS moderno y no todos soportan
 * `flex`/`grid`. El HTML tiene que verse igual sin hoja de estilos externa.
 */
export interface EmailLayoutInput {
  subject: string;
  heading: string;
  intro: string;
  /** Contenido extra ya escapado, se inserta debajo del intro. */
  bodyHtml?: string;
  actionLabel?: string;
  actionUrl?: string;
  footnote?: string;
}

export function emailLayout(input: EmailLayoutInput): {
  subject: string;
  html: string;
} {
  const action =
    input.actionLabel && input.actionUrl
      ? `<a href="${escapeAttr(
          input.actionUrl,
        )}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
                  ${escapeHtml(input.actionLabel)}
                </a>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#18181b;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">TaskMaster</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 8px;font-size:20px;color:#18181b;">${escapeHtml(
                  input.heading,
                )}</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                  ${escapeHtml(input.intro)}
                </p>
                ${input.bodyHtml ?? ""}
                ${action}
                ${
                  input.footnote
                    ? `<p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">${escapeHtml(
                        input.footnote,
                      )}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: input.subject, html };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
