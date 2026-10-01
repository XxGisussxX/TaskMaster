import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { type RedisOptions } from "ioredis";

/** Corte de espera de cada comando. Un comando más lento que esto se considera caído. */
const COMMAND_TIMEOUT_MS = 1_000;

/** Espera máxima al abrir el socket. */
const CONNECT_TIMEOUT_MS = 2_000;

/** Tope de la espera entre reconexiones: evitacastigar a un Redis que tarda en volver. */
const MAX_RECONNECT_DELAY_MS = 5_000;

/**
 * Ventana de agrupamiento de los logs de degradación.
 *
 * Sin esto, cada request que toca el rate limit loguearía un error y un Redis
 * caído llenaría el disco en minutos. Se loguea el primer fallo y después uno
 * por minuto, con el total acumulado para que el silencio no esconda volumen.
 */
const DEGRADED_LOG_INTERVAL_MS = 60_000;

export interface RedisStatus {
  healthy: boolean;
  lastError?: string;
  /** Epoch ms del primer fallo desde el último estado healthy. */
  degradedSince?: number;
  /** Operaciones que cayeron al fallback desde que empezó la degradación. */
  degradedOperations: number;
}

/**
 * Cliente Redis único de la aplicación.
 *
 * Es el dueño del estado que no puede vivir en el proceso: rate limit, bloqueo
 * de cuenta y cuota diaria de IA. Dos decisiones definen su comportamiento.
 *
 * **Al arrancar, fail-closed.** `onModuleInit` abre la conexión y hace un PING;
 * si falla lanza y la API no levanta. Redis holds estado de seguridad y una
 * instancia arrancada sin él tendría los contadores en cero desde el primer
 * segundo, que es el peor momento para descubrirlo.
 *
 * **En runtime, fail-open.** Un Redis caído no puede tirar el producto: cada
 * consumidor pasa su fallback en memoria (el comportamiento previo a esta fase)
 * y acá se deja rastro. Preferimos una ventana de límite por proceso a no
 * servir tráfico. El punto de partida para el que el límite no se puede evadir
 * entre réplicas es que Redis esté sano, y eso lo reporta `/health`.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private connection!: Redis;
  private healthy = true;
  private lastError: string | undefined;
  private degradedSince: number | undefined;
  private degradedOperations = 0;
  private lastDegradedLogAt = 0;

  constructor(private readonly config: ConfigService) {}

  /**
   * Cliente crudo. Se expone para los scripts Lua (EVAL), que no tienen un tipo
   * en el paquete de ioredis. Los consumidores deben envolver sus comandos en
   * {@link withFallback} para no dejar pasar errores de Redis sin registrar.
   *
   * Lanza si se llama antes de que `onModuleInit` tenga éxito. Con la app ya
   * arrancada ese caso no existe; el test que fuerza un arranque fallido sí lo
   * cubre, y es preferible un error explícito a un `undefined` que revienta
   * dentro de un script.
   */
  get client(): Redis {
    if (!this.connection) {
      throw new Error(
        "Redis no inicializado: onModuleInit no completó (¿Redis caído al arrancar?)",
      );
    }
    return this.connection;
  }

  /** Prefijo de todas las keys, para los constructores de {@link RedisKeys}. */
  get keyPrefix(): string {
    return this.config.get<string>("REDIS_KEY_PREFIX") ?? "taskmaster";
  }

  get status(): RedisStatus {
    return {
      healthy: this.healthy,
      lastError: this.lastError,
      degradedSince: this.degradedSince,
      degradedOperations: this.degradedOperations,
    };
  }

  async onModuleInit(): Promise<void> {
    await this.assertReachable();

    this.connection = new Redis(this.buildOptions());

    // Sin este listener, ioredis emite 'error' sin ningún handler y el proceso
    // muere por una excepción no manejada en el primer fallo de conexión.
    this.connection.on("error", (error: Error) => this.noteFailure(error));

    try {
      await this.connection.connect();
      await this.ping();
    } catch (error) {
      // Redis estaba vivo un instante antes y ya no: se propaga igual, por la
      // misma razón que en `assertReachable`.
      this.connection.disconnect();
      throw error;
    }

    this.logger.log(`Redis conectado en ${this.describeTarget()}`);
  }

  /**
   * Fail-closed de arranque: confirma que Redis responde antes de levantar la API.
   *
   * Usa un cliente descartable con las reconexiones desactivadas en lugar del
   * cliente de larga vida. Si se usara ese, un fallo de conexión lo dejaría a
   * mitad de un ciclo de reconexión, con timers pendientes y un estado
   * inconsistente: exactamente el tipo de resto que es difícil de depurar cuando
   * el síntoma es "la API no arrancó". Además, durante el arranque no hay
   * requests que proteger, así que reintentar no aporta nada.
   *
   * Propagar el error aborta el bootstrap: arrancar sin Redis dejaría los
   * contadores de rate limit, lockout y cuota en cero desde el primer request.
   */
  private async assertReachable(): Promise<void> {
    const probe = new Redis({
      ...this.buildOptions(),
      retryStrategy: () => null,
    });

    // El probe también necesita listener de 'error'. ioredis no lanza en este
    // caso (imprime "[ioredis] Unhandled error event"), pero en un arranque
    // fallido eso significaría ver ese ruido de librería junto al mensaje que
    // sí dice qué hacer. Además es el mismo requisito del cliente real.
    probe.on("error", () => {});

    try {
      await probe.connect();
      await probe.ping();
    } catch (error) {
      this.logger.error(
        `No se pudo conectar a Redis en ${this.describeTarget()}: ${this.message(error)}. ` +
          `Levantá el servicio con 'docker compose up -d redis' o corregí REDIS_HOST/REDIS_PORT.`,
      );
      throw error;
    } finally {
      probe.disconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connection) return;
    try {
      await this.connection.quit();
    } catch {
      // Corta la conexión sin esperar el reply: el servidor puede ya estar
      // caído y no vale la pena retrasar el shutdown por eso.
      this.connection.disconnect();
    }
  }

  /**
   * Ejecuta una operación de Redis y cae al fallback si falla.
   *
   * Centraliza el try/catch y la contabilidad de la degradación para que los
   * tres consumidores (throttler, lockout, cuota de IA) no la repitan. El
   * fallback tiene que devolver el mismo tipo y la misma semántica que Redis:
   * en el peor caso el límite cuenta por proceso, que es como funcionaba antes
   * de esta fase.
   *
   * El fallback acepta `Promise` a propósito: los tres respaldos en memoria son
   * asíncronos (el del throttler consulta timers, los otros dos a la DB), así
   * que un tipo `() => T` los obligaría a mentir con `await` fuera de lugar.
   */
  async withFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      const result = await operation();
      this.noteRecovery();
      return result;
    } catch (error) {
      this.noteFailure(error, label);
      return await fallback();
    }
  }

  /**
   * PING de liveness. Lanza si Redis no responde.
   *
   * No lleva timeout propio: el cliente ya tiene `commandTimeout`, que ioredis
   * aplica a todos los comandos. Un `Promise.race` con un timer propio dejaría
   * el comando original pendiente y su rechazo posterior sin manejar.
   *
   * Marca la recuperación en el éxito para que `/health` pueda reportar Redis
   * como sano aunque no haya pasado tráfico desde que volvió: si no, el estado
   * recién se restauraría con el primer request, que puede tardar en llegar.
   */
  async ping(): Promise<void> {
    await this.client.ping();
    this.noteRecovery();
  }

  private buildOptions(): RedisOptions {
    const password = this.config.get<string>("REDIS_PASSWORD");
    return {
      host: this.config.get<string>("REDIS_HOST") ?? "localhost",
      port: this.config.get<number>("REDIS_PORT") ?? 6379,
      db: this.config.get<number>("REDIS_DB") ?? 0,
      ...(password ? { password } : {}),
      // La conexión se abre explícitamente en onModuleInit: se quiere que el
      // fallo sea un error de arranque, no una promesa que se rechaza sola.
      lazyConnect: true,
      connectTimeout: CONNECT_TIMEOUT_MS,
      commandTimeout: COMMAND_TIMEOUT_MS,
      // Un comando que no vuelve en COMMAND_TIMEOUT_MS se considera perdido y
      // cae al fallback en memoria. Sin esto, un Redis lento cuelga requests en
      // vez de degradar.
      socketTimeout: CONNECT_TIMEOUT_MS,
      /**
       * 0 = en el primer intento de reconexión se descarta la cola de comandos.
       *
       * Con el default (20) los comandos quedan encolados esperando una
       * reconexión que puede no llegar nunca, y el fallback en memoria jamás se
       * alcanzaría. Con 0 el fallback entra en ~1s y, como sólo aplica cuando
       * la conexión ya está caída, no afecta al camino normal.
       */
      maxRetriesPerRequest: 0,
      retryStrategy: (attempt: number) =>
        Math.min(attempt * 200, MAX_RECONNECT_DELAY_MS),
    };
  }

  private describeTarget(): string {
    const host = this.config.get<string>("REDIS_HOST") ?? "localhost";
    const port = this.config.get<number>("REDIS_PORT") ?? 6379;
    const db = this.config.get<number>("REDIS_DB") ?? 0;
    return `${host}:${port}/${db}`;
  }

  /** Registra una caída. Loguea el primer fallo y luego uno por minuto. */
  private noteFailure(error: unknown, label?: string): void {
    const now = Date.now();
    this.lastError = this.message(error);

    if (!this.healthy) {
      this.degradedOperations += 1;
      this.logDegradedPeriodically(now);
      return;
    }

    this.healthy = false;
    this.degradedSince = now;
    this.degradedOperations = 1;
    this.lastDegradedLogAt = now;

    const origin = label ? `${label}: ` : "conexión: ";
    this.logger.warn(
      `Redis no disponible (${origin}${this.lastError}). ` +
        "Rate limit, lockout y cuota de IA pasan a contar en memoria por proceso " +
        "hasta que se recupere: el límite deja de ser compartido entre réplicas.",
    );
  }

  /** Loguea la recuperación una sola vez, con el costo de la ventana caída. */
  private noteRecovery(): void {
    if (this.healthy) return;

    const durationMs = Date.now() - (this.degradedSince ?? Date.now());
    const failed = this.degradedOperations;
    this.reset();

    this.logger.log(
      `Redis recuperada tras ${Math.round(durationMs / 1000)}s degradada ` +
        `(${failed} operación/es con fallback en memoria).`,
    );
  }

  private logDegradedPeriodically(now: number): void {
    if (now - this.lastDegradedLogAt < DEGRADED_LOG_INTERVAL_MS) return;
    this.lastDegradedLogAt = now;
    this.logger.warn(
      `Redis sigue no disponible (${this.lastError}): ` +
        `${this.degradedOperations} operación/es con fallback en memoria desde el inicio.`,
    );
  }

  private reset(): void {
    this.healthy = true;
    this.lastError = undefined;
    this.degradedSince = undefined;
    this.degradedOperations = 0;
  }

  private message(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
