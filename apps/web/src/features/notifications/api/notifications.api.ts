import type { Notification } from "@taskmaster/contracts";
import { http } from "@/services/http";

export const notificationsApi = {
  list: (params?: {
    unreadOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.unreadOnly) searchParams.set("unreadOnly", "true");
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
    const qs = searchParams.toString();
    return http.get<{ items: Notification[]; total: number }>(
      `/notifications${qs ? `?${qs}` : ""}`,
    );
  },

  unreadCount: () => http.get<number>("/notifications/unread-count"),

  markAsRead: (id: string) =>
    http.patch<{ id: string }>(`/notifications/${id}/read`),

  markAllAsRead: () => http.post<{ count: number }>("/notifications/read-all"),
};
