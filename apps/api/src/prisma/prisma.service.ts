import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { tenantExtension } from "./tenant.extension";

/** Crea el cliente Prisma con la extensión de aislamiento multi-tenant. */
export function createPrismaClient() {
  return new PrismaClient().$extends(tenantExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Token de inyección y tipo que consumen los servicios.
 *
 * En runtime el provider entrega la instancia extendida (ver `PrismaModule`);
 * el tipo conserva la superficie de `PrismaClient` para los llamadores, de modo
 * que `this.prisma.task...` sigue tipando igual.
 */
export class PrismaService extends PrismaClient {}

/**
 * Conecta/desconecta el cliente extendido siguiendo el ciclo de vida de Nest.
 * Se separa de `PrismaService` porque el valor inyectado es la instancia
 * devuelta por `$extends` (no instanciada por Nest).
 */
@Injectable()
export class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(PrismaService) private readonly prisma: ExtendedPrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
