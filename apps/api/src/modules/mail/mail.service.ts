import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { buildInviteEmail } from "./invite-email.template";
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "./auth-email.template";

export interface SendInviteInput {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface SendAuthEmailInput {
  to: string;
  actionUrl: string;
  expiresAt: Date;
}

const DEV_FALLBACK_URL =
  "https://resend.com/dashboard (configurá RESEND_API_KEY para enviar emails reales)";

/**
 * Los links de invitación/verificación/reset son bearer: con el token (y el
 * email destinatario) se entra a la cuenta. Escribirlos en el log los convierte
 * en un canal de robo, porque los logs se archivan, se indexan y se comparten
 * con cualquier tool de soporte. En la URL solo queda el path, sin query string.
 */
function redactActionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}?<token oculto>`;
  } catch {
    return "<url inválida>";
  }
}

/** Conserva el dominio para poder diagnosticar, oculta la parte local. */
function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.configured = Boolean(apiKey);
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
    }
    this.from =
      this.config.get<string>("MAIL_FROM") ||
      "TaskMaster <onboarding@taskmaster.app>";
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  /** Configuración actual del provider, para que la API la exponga al frontend. */
  emailConfig(): { isConfigured: boolean; isDev: boolean } {
    return {
      isConfigured: this.configured,
      isDev: this.config.get<string>("NODE_ENV") !== "production",
    };
  }

  /** Envía la invitación por email o, si no hay provider, loguea el link (dev). */
  async sendInvite(input: SendInviteInput): Promise<{ sent: boolean }> {
    const { subject, html } = buildInviteEmail(input);
    return this.sendHtml(input.to, subject, html, input.inviteUrl);
  }

  /** Envía el email de verificación de email con su link de confirmación. */
  async sendVerification(
    input: SendAuthEmailInput,
  ): Promise<{ sent: boolean }> {
    const { subject, html } = buildVerificationEmail(input);
    return this.sendHtml(input.to, subject, html, input.actionUrl);
  }

  /** Envía el email de restablecimiento de contraseña con su link. */
  async sendPasswordReset(
    input: SendAuthEmailInput,
  ): Promise<{ sent: boolean }> {
    const { subject, html } = buildPasswordResetEmail(input);
    return this.sendHtml(input.to, subject, html, input.actionUrl);
  }

  private async sendHtml(
    to: string,
    subject: string,
    html: string,
    devLogUrl: string,
  ): Promise<{ sent: boolean }> {
    if (!this.resend) {
      this.logger.warn(
        `No hay RESEND_API_KEY configurada. Destinatario=${maskEmail(to)}, enlace=${redactActionUrl(devLogUrl)} — ${DEV_FALLBACK_URL}`,
      );
      return { sent: false };
    }

    const result = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });

    if (!result.data) {
      const message =
        result.error?.message ?? "Resend no devolvió confirmación de envío";
      this.logger.error(`Resend rechazó el envío a ${to}: ${message}`);
      return { sent: false };
    }

    return { sent: true };
  }
}
