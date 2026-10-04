import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";

const RETENTION_REVOKED_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Diario a las 03:00: limpia tokens expirados y revocados antiguos. */
  @Cron("0 0 3 * * *")
  async cleanExpiredRefreshTokens(): Promise<void> {
    const cutoffRevoked = new Date(Date.now() - RETENTION_REVOKED_MS);

    const deleted = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null, lt: cutoffRevoked } },
        ],
      },
    });

    if (deleted.count > 0) {
      this.logger.log(
        `Limpieza de refresh tokens: ${deleted.count} eliminados`,
      );
    }

    // Los handoffs de OAuth que el usuario nunca canjeó (cerró la pestaña, le
    // dio error la red) se acumulan: son filas cortas pero incesantes. Se van en
    // el mismo cron en vez de sumar otro timer.
    const now = new Date();
    const handoffs = await this.prisma.authToken.deleteMany({
      where: { type: "OAUTH_HANDOFF", expiresAt: { lt: now } },
    });
    if (handoffs.count > 0) {
      this.logger.log(
        `Limpieza de handoffs OAuth: ${handoffs.count} eliminados`,
      );
    }
  }
}
