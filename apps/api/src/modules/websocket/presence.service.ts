import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { EventsService } from "./events.service";

/**
 * Quién está conectado en cada workspace.
 *
 * La presencia no se guarda en la base a propósito: es un estado efímero que se
 * reconstruye con un heartbeat, y su única fuente de verdad son los sockets
 * vivos. Persistirla produciría filas que sobreviven al proceso y que hay que
 * limpiar a mano.
 *
 * Vive aparte del gateway para que la lógica sea testeable sin un socket real.
 */

/** Cada cuánto el cliente declara que sigue ahí. */
export const PRESENCE_HEARTBEAT_MS = 30_000;

/**
 * Después de cuánto tiempo sin heartbeat se considera que el cliente se fue.
 *
 * Tres latidos de margen: que uno se pierda no debería borrar a alguien que
 * está mirando la pantalla.
 */
export const PRESENCE_TIMEOUT_MS = 90_000;

/** Cada cuánto se barren los que no dieron señales. */
export const PRESENCE_SWEEP_MS = 15_000;

/** workspaceId → (userId → (socketId → último latido)). */
type WorkspacePresence = Map<string, Map<string, Map<string, number>>>;

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  private readonly byWorkspace: WorkspacePresence = new Map();
  /** socketId → workspaces en los que está presente. */
  private readonly socketWorkspaces = new Map<string, Set<string>>();
  /** socketId → userId. */
  private readonly socketUsers = new Map<string, string>();

  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(private readonly events: EventsService) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, PRESENCE_SWEEP_MS);
    // Sin `unref` el timer mantiene el proceso vivo, tanto en los tests como en
    // cualquier script que arranque el servicio sin cerrarlo.
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /** Registra que un socket entró a un workspace. Devuelve si cambió el estado. */
  join(
    socketId: string,
    userId: string,
    workspaceId: string,
    now = Date.now(),
  ): boolean {
    const wasOnline = this.isOnline(userId, workspaceId, now);
    this.touch(socketId, userId, workspaceId, now);

    if (!wasOnline) {
      this.events.emit("presence.changed", { workspaceId });
      return true;
    }
    return false;
  }

  /** Saca al socket de un workspace. Devuelve si cambió el estado. */
  leave(socketId: string, userId: string, workspaceId: string): boolean {
    const userSockets = this.byWorkspace.get(workspaceId)?.get(userId);
    const wasOnline = Boolean(userSockets && userSockets.size > 0);

    userSockets?.delete(socketId);
    if (userSockets && userSockets.size === 0) {
      this.byWorkspace.get(workspaceId)?.delete(userId);
    }
    this.pruneWorkspace(workspaceId);
    this.dropSocketWorkspace(socketId, workspaceId);

    // Si le queda otro socket del mismo usuario, sigue estando presente.
    if (!wasOnline || this.isOnline(userId, workspaceId)) return false;

    this.events.emit("presence.changed", { workspaceId });
    return true;
  }

  /**
   * Refresca el latido de un socket.
   *
   * Solo emite si el socket vuelve de estar caído, porque un heartbeat es lo más
   * frecuente que va a pasar y no puede ser un evento de broadcast.
   */
  heartbeat(socketId: string, now = Date.now()): void {
    const userId = this.socketUsers.get(socketId);
    if (!userId) return;

    for (const workspaceId of this.socketWorkspaces.get(socketId) ?? []) {
      const wasOnline = this.isOnline(userId, workspaceId, now);
      this.touch(socketId, userId, workspaceId, now);
      if (!wasOnline) {
        this.events.emit("presence.changed", { workspaceId });
        this.logger.debug(
          `Presencia recuperada en ${workspaceId} tras un corte de latidos`,
        );
      }
    }
  }

  /** Borra al socket de todos los workspaces donde estaba. */
  disconnect(socketId: string): void {
    const userId = this.socketUsers.get(socketId);
    const workspaces = this.socketWorkspaces.get(socketId);
    if (!userId || !workspaces) return;

    for (const workspaceId of workspaces) {
      this.byWorkspace.get(workspaceId)?.get(userId)?.delete(socketId);
      if (this.byWorkspace.get(workspaceId)?.get(userId)?.size === 0) {
        this.byWorkspace.get(workspaceId)?.delete(userId);
      }
      this.pruneWorkspace(workspaceId);

      if (!this.isOnline(userId, workspaceId)) {
        this.events.emit("presence.changed", { workspaceId });
      }
    }

    this.socketWorkspaces.delete(socketId);
    this.socketUsers.delete(socketId);
  }

  /**
   * Barre los sockets que dejaron de dar señales y devuelve qué workspaces
   * cambiaron.
   *
   * No se puede confiar solo en `disconnect`: si el browser se cuelga o se corta
   * la red, el evento nunca llega y el usuario queda "activo" para siempre. Es el
   * mismo modo de falla por el que el arranque fail-fast de Redis no confía en
   * que la conexión esté lista.
   *
   * El registro del socket sobrevive al barrido a propósito. Un cliente con la
   * red intermitente puede volver a latir después de un corte sin reconectar, y
   * olvidarlo lo dejaría invisible hasta que recargara la página. La limpieza de
   * esos registros la hace `disconnect`, que sí llega cuando el socket se cierra
   * de verdad.
   */
  sweep(now = Date.now()): string[] {
    const changed = new Set<string>();

    for (const [workspaceId, users] of [...this.byWorkspace]) {
      for (const [userId, sockets] of [...users]) {
        // "¿Estaba presente?" se responde antes de podar, no con `isOnline` en el
        // mismo instante: al vencer el timeout, `isOnline` ya devuelve false y
        // comparar antes y después decía siempre "no cambió", así que el
        // workspace se quedaba con un snapshot con alguien que ya se fue.
        const wasPresent = sockets.size > 0;

        for (const [socketId, lastSeen] of [...sockets]) {
          if (now - lastSeen >= PRESENCE_TIMEOUT_MS) sockets.delete(socketId);
        }

        if (sockets.size === 0) users.delete(userId);
        if (wasPresent && !this.isOnline(userId, workspaceId, now)) {
          changed.add(workspaceId);
        }
      }

      if (users.size === 0) this.byWorkspace.delete(workspaceId);
    }

    for (const workspaceId of changed) {
      this.events.emit("presence.changed", { workspaceId });
    }
    return [...changed];
  }

  /** Usuarios con al menos un socket vivo en el workspace. */
  activeUserIds(workspaceId: string, now = Date.now()): string[] {
    const users = this.byWorkspace.get(workspaceId);
    if (!users) return [];
    return [...users.keys()].filter((userId) =>
      this.isOnline(userId, workspaceId, now),
    );
  }

  activeCount(workspaceId: string, now = Date.now()): number {
    return this.activeUserIds(workspaceId, now).length;
  }

  // ── interno ──────────────────────────────────────────────────────────

  private touch(
    socketId: string,
    userId: string,
    workspaceId: string,
    now: number,
  ): void {
    let users = this.byWorkspace.get(workspaceId);
    if (!users) {
      users = new Map();
      this.byWorkspace.set(workspaceId, users);
    }
    let sockets = users.get(userId);
    if (!sockets) {
      sockets = new Map();
      users.set(userId, sockets);
    }
    sockets.set(socketId, now);

    this.socketUsers.set(socketId, userId);
    const tracked = this.socketWorkspaces.get(socketId);
    if (tracked) tracked.add(workspaceId);
    else this.socketWorkspaces.set(socketId, new Set([workspaceId]));
  }

  private isOnline(
    userId: string,
    workspaceId: string,
    now = Date.now(),
  ): boolean {
    const sockets = this.byWorkspace.get(workspaceId)?.get(userId);
    if (!sockets) return false;
    for (const lastSeen of sockets.values()) {
      if (now - lastSeen < PRESENCE_TIMEOUT_MS) return true;
    }
    return false;
  }

  private pruneWorkspace(workspaceId: string): void {
    if (this.byWorkspace.get(workspaceId)?.size === 0) {
      this.byWorkspace.delete(workspaceId);
    }
  }

  private dropSocketWorkspace(socketId: string, workspaceId: string): void {
    const tracked = this.socketWorkspaces.get(socketId);
    if (!tracked) return;
    tracked.delete(workspaceId);
    if (tracked.size === 0) {
      this.socketWorkspaces.delete(socketId);
      this.socketUsers.delete(socketId);
    }
  }
}
