export interface InviteEmailData {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export function buildInviteEmail(data: InviteEmailData): {
  subject: string;
  html: string;
} {
  const expiresLabel = new Intl.DateTimeFormat("es", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(data.expiresAt);

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invitación a ${escapeHtml(data.workspaceName)}</title>
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
                <h1 style="margin:0 0 8px;font-size:20px;color:#18181b;">Te invitaron a un workspace</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                  <strong style="color:#18181b;">${escapeHtml(
                    data.inviterName,
                  )}</strong> te invitó a unirte al workspace <strong style="color:#18181b;">${escapeHtml(
                    data.workspaceName,
                  )}</strong> en TaskMaster.
                </p>
                <a href="${escapeAttr(
                  data.inviteUrl,
                )}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
                  Aceptar invitación
                </a>
                <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                  El enlace expira el ${escapeHtml(
                    expiresLabel,
                  )}. Si no reconoces esta invitación, podés ignorar este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: `Invitación a ${data.workspaceName}`,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
