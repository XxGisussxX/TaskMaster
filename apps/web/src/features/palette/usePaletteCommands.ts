import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  StickyNote,
  LayoutGrid,
  Rows3,
  Kanban,
  BarChart3,
  CheckCheck,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { NAV_ITEMS } from "@/app/nav";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { useFiltersStore } from "@/store/filters.store";
import { usePaletteRegistry, type PaletteCommand } from "./registry";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import {
  useMarkAllAsRead,
  useUnreadCount,
} from "@/features/notifications/hooks/useNotifications";

/** Registra los comandos de navegación y acciones de la app en la paleta. */
export function usePaletteCommands() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const { canWrite, hasWorkspace } = useCurrentMembership();
  const { data: unread = 0 } = useUnreadCount();
  const { mutate: markAllRead } = useMarkAllAsRead();
  const setView = useFiltersStore((s) => s.setView);
  const toggleOnlyMine = useFiltersStore((s) => s.toggleOnlyMine);
  const toggleOnlyOverdue = useFiltersStore((s) => s.toggleOnlyOverdue);
  const resetFilters = useFiltersStore((s) => s.reset);
  const setTheme = useUiStore((s) => s.setTheme);
  const requestTaskModal = useUiStore((s) => s.requestTaskModal);
  const requestNoteCreate = useUiStore((s) => s.requestNoteCreate);
  const registerCommand = usePaletteRegistry((s) => s.registerCommand);
  const unregisterCommand = usePaletteRegistry((s) => s.unregisterCommand);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      ...NAV_ITEMS.filter(
        (item) =>
          !item.systemRoles ||
          (userRole && item.systemRoles.includes(userRole)),
      ).map((item): PaletteCommand => ({
        id: `nav.${item.to}`,
        group: "navigation",
        section: "Navegación",
        title: `Ir a ${item.label}`,
        hint: item.hint,
        icon: item.icon,
        run: () => navigate(item.to),
      })),

      ...(canWrite && hasWorkspace
        ? ([
            {
              id: "task.create",
              group: "actions" as const,
              section: "Tareas",
              title: "Nueva tarea",
              keywords: ["crear", "agregar", "nueva tarea"],
              icon: Plus,
              run: () => {
                navigate("/tasks");
                requestTaskModal({ mode: "create" });
              },
            },
            {
              id: "note.create",
              group: "actions" as const,
              section: "Notas",
              title: "Nueva nota",
              keywords: ["crear", "agregar", "nueva nota", "notas"],
              icon: StickyNote,
              run: () => {
                navigate("/notes");
                requestNoteCreate();
              },
            },
          ] satisfies PaletteCommand[])
        : []),

      ...(hasWorkspace
        ? ([
            {
              id: "tasks.view.cards",
              group: "actions" as const,
              section: "Vistas",
              title: "Tareas: vista Tarjetas",
              keywords: ["vista", "cards"],
              icon: LayoutGrid,
              run: () => setView("cards"),
            },
            {
              id: "tasks.view.table",
              group: "actions" as const,
              section: "Vistas",
              title: "Tareas: vista Tabla",
              keywords: ["vista", "tabla"],
              icon: Rows3,
              run: () => setView("table"),
            },
            {
              id: "tasks.view.board",
              group: "actions" as const,
              section: "Vistas",
              title: "Tareas: vista Board",
              keywords: ["vista", "board"],
              icon: Kanban,
              run: () => setView("board"),
            },
            {
              id: "tasks.view.gantt",
              group: "actions" as const,
              section: "Vistas",
              title: "Tareas: vista Gantt",
              keywords: ["vista", "gantt"],
              icon: BarChart3,
              run: () => setView("gantt"),
            },
            {
              id: "tasks.filters.mine",
              group: "actions" as const,
              section: "Filtros",
              title: "Filtrar: solo mis tareas",
              keywords: ["filtro", "mías", "mias"],
              icon: LayoutGrid,
              run: () => toggleOnlyMine(),
            },
            {
              id: "tasks.filters.overdue",
              group: "actions" as const,
              section: "Filtros",
              title: "Filtrar: solo atrasadas",
              keywords: ["filtro", "atrasadas"],
              icon: LayoutGrid,
              run: () => toggleOnlyOverdue(),
            },
            {
              id: "tasks.filters.reset",
              group: "actions" as const,
              section: "Filtros",
              title: "Limpiar filtros de tareas",
              keywords: ["filtro", "reset", "limpiar"],
              icon: LayoutGrid,
              run: () => resetFilters(),
            },
          ] satisfies PaletteCommand[])
        : []),

      ...(unread > 0
        ? ([
            {
              id: "notifications.read-all",
              group: "actions" as const,
              section: "Notificaciones",
              title: "Marcar todas como leídas",
              keywords: ["notificaciones", "leídas", "leidas"],
              icon: CheckCheck,
              run: () => markAllRead(),
            },
          ] satisfies PaletteCommand[])
        : []),

      ...([
        {
          id: "theme.light",
          group: "actions" as const,
          section: "Personalización",
          title: "Tema claro",
          keywords: ["tema", "claro"],
          icon: Sun,
          run: () => setTheme("light"),
        },
        {
          id: "theme.dark",
          group: "actions" as const,
          section: "Personalización",
          title: "Tema oscuro",
          keywords: ["tema", "oscuro"],
          icon: Moon,
          run: () => setTheme("dark"),
        },
        {
          id: "theme.system",
          group: "actions" as const,
          section: "Personalización",
          title: "Tema sistema",
          keywords: ["tema", "sistema"],
          icon: Monitor,
          run: () => setTheme("system"),
        },
      ] satisfies PaletteCommand[]),
    ],
    [
      canWrite,
      hasWorkspace,
      unread,
      userRole,
      navigate,
      setView,
      toggleOnlyMine,
      toggleOnlyOverdue,
      resetFilters,
      setTheme,
      requestTaskModal,
      requestNoteCreate,
      markAllRead,
    ],
  );

  useEffect(() => {
    commands.forEach((c) => registerCommand(c));
    return () => commands.forEach((c) => unregisterCommand(c.id));
  }, [commands, registerCommand, unregisterCommand]);
}
