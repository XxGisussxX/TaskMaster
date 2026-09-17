import { Global, Module } from "@nestjs/common";
import {
  PrismaLifecycle,
  PrismaService,
  UnscopedPrismaService,
  createPrismaClient,
  getUnscopedPrismaClient,
} from "./prisma.service";

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: createPrismaClient,
    },
    // Escape hatch del aislamiento multi-tenant. Solo puede inyectarse en los
    // flujos legítimos sin contexto de workspace:
    //   1. workspaces/workspace-access.service.ts (autorización previa al contexto)
    //   2. workspaces/workspaces.service.ts (rutas :id sin :workspaceId)
    //   3. websocket/websocket.gateway.ts (handshake, no hay request HTTP)
    //   4. reminders/reminders.service.ts (job @Cron, sin request)
    // Un quinto uso debe justificarse explícitamente en el PR: el default es
    // usar PrismaService, que es fail-closed.
    {
      provide: UnscopedPrismaService,
      useFactory: getUnscopedPrismaClient,
    },
    PrismaLifecycle,
  ],
  exports: [PrismaService, UnscopedPrismaService],
})
export class PrismaModule {}
