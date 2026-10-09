import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  PRESENCE_HEARTBEAT_EVENT,
  PRESENCE_SNAPSHOT_EVENT,
} from "@taskmaster/contracts";
import { useAuthStore } from "@/store/auth.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import {
  applyPresenceSnapshot,
  usePresenceStore,
} from "@/store/presence.store";

/**
 * Cadencia del latido de presencia.
 *
 * Va en el cliente y no se importa del backend a propósito: el bundle no debe
 * depender de `apps/api`. Tiene que quedar holgadamente por debajo del timeout
 * del servidor para tolerar latidos perdidos sin marcar a nadie como fuera.
 */
const PRESENCE_HEARTBEAT_MS = 30_000;

export function useSocket() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [socket, setSocket] = useState<Socket | null>(null);
  // Ref para deduplicar el join sin provocar renders; state para que los
  // efectos que dependen de "ya se unirse" repitan cuando el join ocurre.
  const joinedWorkspace = useRef<string | null>(null);
  const [joinedWorkspaceId, setJoinedWorkspaceId] = useState<string | null>(
    null,
  );

  // Conexión: depende solo de la sesión. Cambiar de workspace no debe reabrir el
  // socket; ese teardown a mitad del handshake producía el warning
  // "WebSocket is closed before the connection is established".
  useEffect(() => {
    const token = useAuthStore.getState().getAccessToken();
    if (!user || !token) {
      setSocket(null);
      joinedWorkspace.current = null;
      setJoinedWorkspaceId(null);
      return;
    }

    const instance = io({
      // Se lee el token al (re)conectar para no quedar con uno vencido tras un refresh.
      auth: (cb) => cb({ token: useAuthStore.getState().getAccessToken() }),
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    setSocket(instance);

    // Diferir el connect salta el doble montaje de StrictMode: el primer efecto
    // se limpia antes de que arranque el handshake, así no queda un cierre
    // prematuro del WebSocket.
    const connectTimer = setTimeout(() => instance.connect(), 0);

    return () => {
      clearTimeout(connectTimer);
      instance.disconnect();
      setSocket(null);
      joinedWorkspace.current = null;
      setJoinedWorkspaceId(null);
    };
  }, [user]);

  // Unirse al workspace activo sin recrear la conexión.
  useEffect(() => {
    if (!socket || !currentWorkspaceId) return;

    const join = () => {
      if (joinedWorkspace.current === currentWorkspaceId) return;
      socket.emit("workspace:join", { workspaceId: currentWorkspaceId });
      joinedWorkspace.current = currentWorkspaceId;
      setJoinedWorkspaceId(currentWorkspaceId);
    };

    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [socket, currentWorkspaceId]);

  // ── Presence ───────────────────────────────────────────────────────

  // El latido es periódico y no un evento de conexión: si solo se emitiera al
  // conectar, un browser que se cuelga sin cerrar el socket dejaría al usuario
  // marcado como activo para siempre.
  useEffect(() => {
    if (!socket || !joinedWorkspaceId) return;

    const beat = () => socket.emit(PRESENCE_HEARTBEAT_EVENT);
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);

    // Latido inmediato: sin él, la presencia recién conectada no existiría hasta
    // medio minuto después, que es justo lo que un usuario recién entrando
    // nota como "no aparece en la lista".
    beat();

    return () => clearInterval(timer);
  }, [socket, joinedWorkspaceId]);

  // El snapshot llega siempre, también con lista vacía. Si se ignorara el
  // caso vacío, quien quedó con un snapshot viejo seguiría viendo gente que ya
  // se fue.
  useEffect(() => {
    if (!socket) return;

    const onSnapshot = (payload: unknown) => {
      applyPresenceSnapshot(
        payload,
        useWorkspaceStore.getState().currentWorkspaceId,
      );
    };

    socket.on(PRESENCE_SNAPSHOT_EVENT, onSnapshot);

    return () => {
      socket.off(PRESENCE_SNAPSHOT_EVENT, onSnapshot);
    };
  }, [socket]);

  // Al cerrar sesión o cambiar de workspace, la presencia anterior no debe
  // quedar en pantalla.
  useEffect(() => {
    usePresenceStore.getState().reset();
  }, [currentWorkspaceId, user]);

  // ── Notification events ─────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onNewNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    };

    socket.on("notification:new", onNewNotification);

    return () => {
      socket.off("notification:new", onNewNotification);
    };
  }, [socket, queryClient]);

  // ── Task events ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onTaskChange = () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // El diagnóstico de agenda se calcula sobre las tareas, así que si alguien
      // las mueve hay que recalcularlo o quedaría mostrando choques que ya no
      // existen.
      void queryClient.invalidateQueries({ queryKey: ["agenda-review"] });
    };

    const onTaskStatusChange = () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda-review"] });
    };

    socket.on("task:created", onTaskChange);
    socket.on("task:updated", onTaskChange);
    socket.on("task:deleted", onTaskChange);
    socket.on("task:status-changed", onTaskStatusChange);

    return () => {
      socket.off("task:created", onTaskChange);
      socket.off("task:updated", onTaskChange);
      socket.off("task:deleted", onTaskChange);
      socket.off("task:status-changed", onTaskStatusChange);
    };
  }, [socket, queryClient]);

  // ── Comment events ──────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onCommentChange = (payload: { taskId: string }) => {
      void queryClient.invalidateQueries({
        queryKey: ["comments", payload.taskId],
      });
    };

    socket.on("comment:created", onCommentChange);
    socket.on("comment:updated", onCommentChange);
    socket.on("comment:deleted", onCommentChange);

    return () => {
      socket.off("comment:created", onCommentChange);
      socket.off("comment:updated", onCommentChange);
      socket.off("comment:deleted", onCommentChange);
    };
  }, [socket, queryClient]);
}
