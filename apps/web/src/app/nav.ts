import type { SystemRole } from "@taskmaster/contracts";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListTodo,
  StickyNote,
  CalendarDays,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export type NavGroup = "workspace" | "management";

export interface NavItem {
  /** Clave única. Por defecto se usa `to`; necesaria cuando dos ítems comparten ruta. */
  id?: string;
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  end?: boolean;
  group: NavGroup;
  /** Restringir la ruta a roles de plataforma. Sin esta propiedad, es visible para todos. */
  systemRoles?: SystemRole[];
}

/** Rutas principales: fuente única de verdad para Sidebar y Command Palette. */
export const NAV_ITEMS: NavItem[] = [
  // ===== WORKSPACE =====
  {
    to: "/",
    label: "Dashboard",
    hint: "D",
    icon: LayoutDashboard,
    end: true,
    group: "workspace",
  },
  {
    to: "/tasks",
    label: "Tareas",
    hint: "T",
    icon: ListTodo,
    group: "workspace",
  },
  {
    to: "/calendar",
    label: "Calendario",
    hint: "G C",
    icon: CalendarDays,
    group: "workspace",
  },
  {
    to: "/notes",
    label: "Notas",
    hint: "N",
    icon: StickyNote,
    group: "workspace",
  },

  // ===== SETTINGS & MANAGEMENT =====
  {
    id: "settings.team",
    to: "/workspace",
    label: "Workspace & Team",
    hint: "W",
    icon: Users,
    end: true,
    group: "management",
  },
  {
    id: "settings.main",
    to: "/settings",
    label: "Ajustes",
    hint: "A",
    icon: Settings,
    end: true,
    group: "management",
  },
  {
    to: "/admin",
    label: "Administración",
    hint: "G",
    icon: ShieldCheck,
    group: "management",
    systemRoles: ["ADMIN", "SUPER_ADMIN"],
  },
];

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "workspace", label: "WORKSPACE" },
  { id: "management", label: "SETTINGS & MANAGEMENT" },
];
