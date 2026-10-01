import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  StickyNote,
  Sparkles,
  LayoutGrid,
  Rows3,
  Kanban,
  BarChart3,
  CheckCheck,
  SunMoon,
  UserPlus,
  Users,
  Settings2,
  Bookmark,
} from "lucide-react";
import { NAV_ITEMS } from "@/app/nav";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { useFiltersStore } from "@/store/filters.store";
import { usePaletteRegistry, type PaletteCommand } from "./registry";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";
import {
  useMarkAllAsRead,
  useUnreadCount,
} from "@/features/notifications/hooks/useNotifications";

/** Registra los comandos de navegación y acciones de la app en la paleta. */
export function usePaletteCommands() {
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.user?.role);
  const { canWrite, hasWorkspace, isOwnerOrAdmin } = useCurrentMembership();
  const { data: unread = 0 } = useUnreadCount();
  const { mutate: markAllRead } = useMarkAllAsRead();
  const setView = useFiltersStore((s) => s.setView);
  const toggleOnlyMine = useFiltersStore((s) => s.toggleOnlyMine);
  const toggleOnlyOverdue = useFiltersStore((s) => s.toggleOnlyOverdue);
  const resetFilters = useFiltersStore((s) => s.reset);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const requestTaskModal = useUiStore((s) => s.requestTaskModal);
  const requestNoteCreate = useUiStore((s) => s.requestNoteCreate);
  const requestAssistantDraft = useUiStore((s) => s.requestAssistantDraft);
  const registerCommand = usePaletteRegistry((s) => s.registerCommand);
  const unregisterCommand = usePaletteRegistry((s) => s.unregisterCommand);

  const workspaceId = useCurrentWorkspaceId();
  const aiUnavailable = !workspaceId || isLocalWorkspace(workspaceId);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      // ===== Acciones rápidas =====
      ...(canWrite && hasWorkspace
        ? ([
            {
              id: "task.create",
              group: "actions" as const,
              section: "Tareas",
              title: "Crear nueva tarea",
              keywords: ["crear", "agregar", "nueva tarea"],
              hint: "C",
              icon: Plus,
              run: () => {
                navigate("/tasks");
                requestTaskModal({ mode: "create" });
              },
            },
            {
              id: "task.create.ai",
              group: "actions" as const,
              section: "Tareas",
              title: "Crear tarea con IA",
              keywords: [
                "crear",
                "ia",
                "inteligencia artificial",
                "gemini",
                "borrador",
                "auto",
              ],
              icon: Sparkles,
              run: () => {
                navigate("/tasks");
                requestTaskModal({ mode: "create", ai: true });
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

      ...(!aiUnavailable
        ? ([
            {
              id: "ai.reorganize.week",
              group: "actions" as const,
              section: "IA",
              title: "Pedir a Copilot reorganizar mi semana",
              keywords: [
                "copilot",
                "ia",
                "asistente",
                "semana",
                "reorganizar",
                "priorizar",
                "planificar",
              ],
              icon: Sparkles,
              run: () =>
                requestAssistantDraft(
                  "Hola, ayudame a organizar mi semana priorizando lo más urgente.",
                ),
            },
          ] satisfies PaletteCommand[])
        : []),

      {
        id: "theme.toggle",
        group: "actions" as const,
        section: "Personalización",
        title: "Cambiar a modo claro/oscuro",
        keywords: ["tema", "claro", "oscuro", "modo", "noche", "día", "dia"],
        hint: "T",
        icon: SunMoon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },

      ...NAV_ITEMS.filter(
        (item) =>
          !item.systemRoles ||
          (userRole && item.systemRoles.includes(userRole)),
      ).map((item): PaletteCommand => ({
        id: `nav.${item.id ?? item.to}`,
        group: "navigation",
        section: "Navegación",
        title: `Ir a ${item.label}`,
        hint: item.hint,
        icon: item.icon,
        run: () => navigate(item.to),
      })),

      // ===== Acciones del workspace de tareas =====
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

      // ===== Comandos del workspace =====
      ...(hasWorkspace
        ? ([
            {
              id: "workspace.invite",
              group: "actions" as const,
              section: "Workspace",
              bucket: "workspace",
              title: "Invitar miembros al workspace",
              keywords: [
                "invitar",
                "miembros",
                "invitación",
                "invitacion",
                "colaboradores",
                "equipo",
              ],
              icon: UserPlus,
              run: () => navigate("/workspace"),
              available: () => isOwnerOrAdmin,
            },
            {
              id: "workspace.members",
              group: "actions" as const,
              section: "Workspace",
              bucket: "workspace",
              title: "Ver miembros del workspace",
              keywords: ["miembros", "gestionar", "equipo", "roles"],
              icon: Users,
              run: () => navigate("/workspace"),
            },
            {
              id: "workspace.settings",
              group: "actions" as const,
              section: "Workspace",
              bucket: "workspace",
              title: "Configuración del workspace",
              keywords: [
                "configuración",
                "configuracion",
                "ajustes",
                "workspace",
              ],
              icon: Settings2,
              run: () => navigate("/settings"),
              available: () => isOwnerOrAdmin,
            },
            {
              id: "workspace.saved-views",
              group: "actions" as const,
              section: "Workspace",
              bucket: "workspace",
              title: "Gestionar vistas guardadas",
              keywords: ["vistas", "guardadas", "vista", "filtros guardados"],
              icon: Bookmark,
              run: () => navigate("/tasks"),
            },
          ] satisfies PaletteCommand[])
        : []),
    ],
    [
      canWrite,
      hasWorkspace,
      unread,
      userRole,
      aiUnavailable,
      theme,
      navigate,
      setView,
      toggleOnlyMine,
      toggleOnlyOverdue,
      resetFilters,
      setTheme,
      requestTaskModal,
      requestNoteCreate,
      requestAssistantDraft,
      markAllRead,
      isOwnerOrAdmin,
    ],
  );

  useEffect(() => {
    commands.forEach((c) => registerCommand(c));
    return () => commands.forEach((c) => unregisterCommand(c.id));
  }, [commands, registerCommand, unregisterCommand]);
}
