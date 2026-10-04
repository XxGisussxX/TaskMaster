import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventsService } from "./events.service";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TIMEOUT_MS,
  PresenceService,
} from "./presence.service";

/**
 * La presencia se sostiene sobre un heartbeat del cliente, así que casi todo el
 * código de acá existe para manejar el caso en que ese heartbeat deja de llegar:
 * un browser cerrado a la fuerza, una notebook que se durmió, una red que se
 * cortó. En todos esos casos `disconnect` nunca se dispara.
 */

/**
 * Base temporal de los tests.
 *
 * Se ancla en el reloj real a propósito: los asserts que omiten `now` usan el
 * `Date.now()` por defecto del servicio, y anclar en cero haría que todo usuario
 * ya estuviera vencido antes de la primera aserción. Los tiempos relativos se
 * miden siempre desde acá.
 */
const NOW = Date.now();

function setup() {
  const emit = vi.fn();
  const events = { emit } as unknown as EventsService;
  const service = new PresenceService(events);
  return { service, emit };
}

/** Registra la presencia de un usuario y su socket en un workspace. */
function connect(
  service: PresenceService,
  userId: string,
  workspaceId = "ws1",
  socketId = `s-${userId}`,
  now = NOW,
) {
  service.join(socketId, userId, workspaceId, now);
  return socketId;
}

describe("PresenceService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("alta y conteo", () => {
    it("cuenta al primer usuario que entra", () => {
      const { service } = setup();
      connect(service, "u1");

      expect(service.activeCount("ws1")).toBe(1);
      expect(service.activeUserIds("ws1")).toEqual(["u1"]);
    });

    it("no cuenta dos veces al mismo usuario con dos sockets", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");
      connect(service, "u1", "ws1", "s2");

      expect(service.activeCount("ws1")).toBe(1);
    });

    it("separa los workspaces", () => {
      const { service } = setup();
      connect(service, "u1", "ws1");
      connect(service, "u2", "ws2");

      expect(service.activeCount("ws1")).toBe(1);
      expect(service.activeCount("ws2")).toBe(1);
    });

    it("devuelve cero para un workspace sin nadie", () => {
      const { service } = setup();
      expect(service.activeCount("nada")).toBe(0);
      expect(service.activeUserIds("nada")).toEqual([]);
    });

    it("emite el cambio solo cuando la presencia realmente cambia", () => {
      const { service, emit } = setup();

      connect(service, "u1", "ws1", "s1");
      expect(emit).toHaveBeenCalledWith("presence.changed", {
        workspaceId: "ws1",
      });

      emit.mockClear();
      // Segundo socket del mismo usuario: ya estaba activo, no hay nada que
      // difundir. Cada reconexión generaba un broadcast inútil.
      connect(service, "u1", "ws1", "s2");
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("heartbeat", () => {
    it("mantiene viva la presencia si el cliente sigue latiendo", () => {
      const { service } = setup();
      const socketId = connect(service, "u1", "ws1", "s1");

      const end = NOW + PRESENCE_TIMEOUT_MS * 3;
      for (let now = NOW; now <= end; now += PRESENCE_HEARTBEAT_MS) {
        service.heartbeat(socketId, now);
      }

      expect(service.activeCount("ws1", end)).toBe(1);
    });

    it("tolera un latido perdido sin borrar al usuario", () => {
      const { service } = setup();
      const socketId = connect(service, "u1", "ws1", "s1");

      service.heartbeat(socketId, NOW + PRESENCE_HEARTBEAT_MS);

      // No llegan dos latidos seguidos: sigue dentro del margen de tres,
      // porque perder uno no significa que el usuario se fue.
      expect(service.activeCount("ws1", NOW + PRESENCE_TIMEOUT_MS - 1)).toBe(1);
    });

    it("recupera la presencia si el cliente vuelve después de un corte", () => {
      const { service, emit } = setup();
      const socketId = connect(service, "u1", "ws1", "s1");
      const after = NOW + PRESENCE_TIMEOUT_MS;

      service.sweep(after);
      expect(service.activeCount("ws1", after)).toBe(0);

      emit.mockClear();
      const back = after + 1_000;
      service.heartbeat(socketId, back);

      // El socket sigue registrado a propósito: el barrido saca la presencia
      // vencida pero no olvida el socket, así que un heartbeat diferido la
      // repone sin necesidad de reconectar.
      expect(service.activeCount("ws1", back)).toBe(1);
      expect(emit).toHaveBeenCalledWith("presence.changed", {
        workspaceId: "ws1",
      });
    });

    it("ignora el heartbeat de un socket desconocido", () => {
      const { service, emit } = setup();
      service.heartbeat("fantasma", NOW);

      expect(service.activeCount("ws1")).toBe(0);
      expect(emit).not.toHaveBeenCalled();
    });

    it("no emite por un heartbeat rutinario", () => {
      const { service, emit } = setup();
      const socketId = connect(service, "u1", "ws1", "s1");
      emit.mockClear();

      service.heartbeat(socketId, NOW + 1_000);

      // El latido es lo más frecuente que ocurre; si emitiera, cada workspace
      // con alguien conectado rebotaría eventos todo el tiempo.
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("sweep", () => {
    it("barre al que dejó de dar señales", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");

      const after = NOW + PRESENCE_TIMEOUT_MS;
      expect(service.sweep(after)).toEqual(["ws1"]);
      expect(service.activeCount("ws1", after)).toBe(0);
    });

    it("no barre dentro del timeout", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");

      const before = NOW + PRESENCE_TIMEOUT_MS - 1;
      expect(service.sweep(before)).toEqual([]);
      expect(service.activeCount("ws1", before)).toBe(1);
    });

    it("deja vivo al usuario que tiene otro socket fresco", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1", NOW);
      connect(service, "u1", "ws1", "s2", NOW + PRESENCE_HEARTBEAT_MS);

      // `s1` ya venció; `s2` todavía no. La presencia es por usuario, no por
      // socket: perder una pestaña no debería sacar a la persona del workspace.
      const after = NOW + PRESENCE_HEARTBEAT_MS + PRESENCE_TIMEOUT_MS - 1;
      service.sweep(after);

      expect(service.activeCount("ws1", after)).toBe(1);
    });

    it("marca los workspaces donde la presencia cambió", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");
      connect(service, "u2", "ws2", "s2");

      const after = NOW + PRESENCE_TIMEOUT_MS;
      expect(service.sweep(after).sort()).toEqual(["ws1", "ws2"]);
    });

    it("no marca un workspace donde el usuario sigue presente", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1", NOW);

      const after = NOW + PRESENCE_TIMEOUT_MS;
      service.sweep(after);

      // Sin heartbeat el barrido sí lo saca; lo que importa es que el barrido
      // no invente un workspace vacío para uno que sigue conectado.
      connect(service, "u1", "ws1", "s1", after + 1_000);

      expect(service.sweep(after + 2_000)).toEqual([]);
    });

    it("no re-emite cuando el barrido no cambia nada", () => {
      const { service, emit } = setup();
      connect(service, "u1", "ws1", "s1");

      const after = NOW + PRESENCE_TIMEOUT_MS;
      service.sweep(after);
      emit.mockClear();

      service.sweep(after + 1_000);
      service.sweep(after + 2_000);

      expect(emit).not.toHaveBeenCalled();
      expect(service.activeCount("ws1", after + 2_000)).toBe(0);
    });

    it("limpia el workspace vacío para no dejar estructuras colgando", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");

      const after = NOW + PRESENCE_TIMEOUT_MS;
      service.sweep(after);

      // Con el workspace vacío, `join` tiene que volver a funcionar sin estado
      // residual de la pasada anterior.
      connect(service, "u2", "ws1", "s2", after + 1_000);
      expect(service.activeUserIds("ws1", after + 1_000)).toEqual(["u2"]);
    });
  });

  describe("leave y disconnect", () => {
    it("deja de contar al que se va", () => {
      const { service, emit } = setup();
      const socketId = connect(service, "u1", "ws1");

      emit.mockClear();
      service.leave(socketId, "u1", "ws1");

      expect(service.activeCount("ws1")).toBe(0);
      expect(emit).toHaveBeenCalledWith("presence.changed", {
        workspaceId: "ws1",
      });
    });

    it("mantiene la presencia si queda otro socket del mismo usuario", () => {
      const { service, emit } = setup();
      connect(service, "u1", "ws1", "s1");
      connect(service, "u1", "ws1", "s2");
      emit.mockClear();

      service.leave("s1", "u1", "ws1");

      expect(service.activeCount("ws1")).toBe(1);
      expect(emit).not.toHaveBeenCalled();
    });

    it("disconnect saca al usuario de todos sus workspaces", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");
      connect(service, "u1", "ws2", "s1");

      service.disconnect("s1");

      expect(service.activeCount("ws1")).toBe(0);
      expect(service.activeCount("ws2")).toBe(0);
    });

    it("no afecta a otro usuario al desconectar", () => {
      const { service } = setup();
      connect(service, "u1", "ws1", "s1");
      connect(service, "u2", "ws1", "s2");

      service.disconnect("s1");

      expect(service.activeUserIds("ws1")).toEqual(["u2"]);
    });

    it("ignora la desconexión de un socket desconocido", () => {
      const { service, emit } = setup();
      service.disconnect("nunca-visto");

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("ciclo de vida", () => {
    it("programa y cancela el barrido periódico", () => {
      const { service } = setup();
      vi.useFakeTimers();

      service.onModuleInit();
      service.onModuleDestroy();

      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
    });

    it("deja un solo timer activo mientras corre", () => {
      const { service } = setup();
      vi.useFakeTimers();

      service.onModuleInit();

      // `unref` es lo que evita que un test o un script queden colgados con el
      // proceso vivo esperando el próximo tick.
      expect(vi.getTimerCount()).toBe(1);
      service.onModuleDestroy();
      vi.useRealTimers();
    });
  });
});
