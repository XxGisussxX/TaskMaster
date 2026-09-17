import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";
import { useWorkspaceStore } from "@/store/workspace.store";

let socket: Socket | null = null;

export function useSocket() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.getAccessToken());
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const joinedWorkspace = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    if (!socket) {
      socket = io({
        auth: { token },
        transports: ["websocket", "polling"],
        autoConnect: true,
      });

      socket.on("connect", () => {
        if (
          currentWorkspaceId &&
          joinedWorkspace.current !== currentWorkspaceId
        ) {
          socket!.emit("workspace:join", { workspaceId: currentWorkspaceId });
          joinedWorkspace.current = currentWorkspaceId;
        }
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
        joinedWorkspace.current = null;
      }
    };
  }, [user, token, currentWorkspaceId]);

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
      socket?.off("notification:new", onNewNotification);
    };
  }, [queryClient]);

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
      socket?.off("task:created", onTaskChange);
      socket?.off("task:updated", onTaskChange);
      socket?.off("task:deleted", onTaskChange);
      socket?.off("task:status-changed", onTaskStatusChange);
    };
  }, [queryClient]);

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
      socket?.off("comment:created", onCommentChange);
      socket?.off("comment:updated", onCommentChange);
      socket?.off("comment:deleted", onCommentChange);
    };
  }, [queryClient]);
}
