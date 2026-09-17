import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { tenantExtension } from "./tenant.extension";

let cachedBaseClient: PrismaClient | undefined;

/**
 * Cliente Prisma base, sin la extensión de aislamiento multi-tenant.
 *
 * Es la vía de escape explícita para operaciones legítimas que no tienen un
 * contexto de workspace activo: autorización previa a resolver el contexto,
 * gestión de workspaces/invitaciones, handshake de WebSocket y jobs
 * programados. Se inyecta como `UnscopedPrismaService` para que todo uso quede
 * marcado y sea auditable con un grep.
 *
 * Se cachea a nivel de módulo para que el cliente extendido y el sin extender
 * compartan una única conexión/pool.
 */
export function getUnscopedPrismaClient(): PrismaClient {
  cachedBaseClient ??= new PrismaClient();
  return cachedBaseClient;
}

/** Crea el cliente Prisma con la extensión de aislamiento multi-tenant. */
export function createPrismaClient() {
  return getUnscopedPrismaClient().$extends(tenantExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Token de inyección del cliente con aislamiento multi-tenant (fail-closed).
 *
 * En runtime el provider entrega la instancia extendida (ver `PrismaModule`);
 * el tipo conserva la superficie de `PrismaClient` para los llamadores, de modo
 * que `this.prisma.task...` sigue tipando igual.
 */
export class PrismaService extends PrismaClient {}

/**
 * Token de inyección del cliente sin extensión de tenant.
 *
 * Usarlo solo en los flujos sin contexto enumerados en
 * {@link getUnscopedPrismaClient}; saltarse el aislamiento de forma implícita
 * provoca que `tenant.extension` lance `TenantContextMissingError`.
 */
export class UnscopedPrismaService extends PrismaClient {}

/**
 * Conecta/desconecta el cliente Prisma siguiendo el ciclo de vida de Nest.
 * Se separa de `PrismaService` porque el valor inyectado es la instancia
 * devuelta por `$extends` (no instanciada por Nest).
 */
@Injectable()
export class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(PrismaService) private readonly prisma: ExtendedPrismaClient,
    @Inject(UnscopedPrismaService)
    private readonly unscoped: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
    await this.unscoped.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.unscoped.$disconnect();
    await this.prisma.$disconnect();
  }
}
