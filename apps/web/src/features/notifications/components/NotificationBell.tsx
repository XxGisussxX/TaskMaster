import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "../hooks/useNotifications";
import type { Notification } from "@taskmaster/contracts";
import { formatRelativeTime } from "@/lib/date";

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const isUnread = !notification.readAt;

  return (
    <button
      className={`w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors ${
        isUnread ? "bg-accent/50" : ""
      }`}
      onClick={() => {
        if (isUnread) onRead(notification.id);
      }}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`truncate ${isUnread ? "font-medium" : ""}`}>
            {notification.title}
          </p>
          {notification.body && (
            <p className="truncate text-xs text-muted-foreground">
              {notification.body}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border bg-card shadow-md">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Notificaciones</h3>
        {notifications.some((n) => !n.readAt) && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              markAllAsRead.mutate();
              onClose();
            }}
          >
            Marcar todo como leído
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {isLoading && (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            Cargando...
          </p>
        )}
        {isError && !isLoading && (
          <div className="space-y-2 px-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar las notificaciones
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {!isLoading && !isError && notifications.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            Sin notificaciones
          </p>
        )}
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={(id) => markAsRead.mutate(id)}
          />
        ))}
        {!isLoading && !isError && hasNextPage && (
          <div className="border-t px-3 py-2 text-center">
            <button
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage
                ? "Cargando…"
                : `Cargar más (${notifications.length} de ${total})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const { data: unreadData } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = unreadData ?? 0;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
