import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { buildInviteEmail } from "./invite-email.template";

export interface SendInviteInput {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  expiresAt: Date;
}

const DEV_FALLBACK_URL =
  "https://resend.com/dashboard (configurá RESEND_API_KEY para enviar emails reales)";

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

    if (!this.resend) {
      this.logger.warn(
        `No hay RESEND_API_KEY configurada. Link de invitación (${input.to}): ${input.inviteUrl} — ${DEV_FALLBACK_URL}`,
      );
      return { sent: false };
    }

    const result = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject,
      html,
    });

    if (!result.data) {
      const message =
        result.error?.message ?? "Resend no devolvió confirmación de envío";
      this.logger.error(`Resend rechazó el envío a ${input.to}: ${message}`);
      return { sent: false };
    }

    return { sent: true };
  }
}
