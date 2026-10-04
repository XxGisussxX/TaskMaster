import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";
import { useWorkspaceStore } from "@/store/workspace.store";

export function useSocket() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const [socket, setSocket] = useState<Socket | null>(null);
  const joinedWorkspace = useRef<string | null>(null);

  // Conexión: depende solo de la sesión. Cambiar de workspace no debe reabrir el
  // socket; ese teardown a mitad del handshake producía el warning
  // "WebSocket is closed before the connection is established".
  useEffect(() => {
    if (!user) {
      setSocket(null);
      joinedWorkspace.current = null;
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
    };
  }, [user]);

  // Unirse al workspace activo sin recrear la conexión.
  useEffect(() => {
    if (!socket || !currentWorkspaceId) return;

    const join = () => {
      if (joinedWorkspace.current === currentWorkspaceId) return;
      socket.emit("workspace:join", { workspaceId: currentWorkspaceId });
      joinedWorkspace.current = currentWorkspaceId;
    };

    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [socket, currentWorkspaceId]);

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
    };

    const onTaskStatusChange = () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
