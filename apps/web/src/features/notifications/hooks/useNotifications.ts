import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationsApi } from "../api/notifications.api";
import { useAuthStore } from "@/store/auth.store";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ pageSize: 20 }),
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: !!user && !!accessToken,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      toast.success("Todas las notificaciones marcadas como leídas");
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({
        queryKey: ["notifications", "unread-count"],
      });
    },
  });
}
