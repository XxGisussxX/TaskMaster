import type { SystemRole } from "@taskmaster/contracts";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListTodo,
  StickyNote,
  CalendarDays,
  Settings,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  end?: boolean;
  /** Restringir la ruta a roles de plataforma. Sin esta propiedad, es visible para todos. */
  systemRoles?: SystemRole[];
}

/** Rutas principales: fuente única de verdad para Sidebar y Command Palette. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", hint: "D", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tareas", hint: "T", icon: ListTodo },
  { to: "/notes", label: "Notas", hint: "N", icon: StickyNote },
  { to: "/calendar", label: "Calendario", hint: "C", icon: CalendarDays },
  { to: "/settings", label: "Ajustes", hint: "A", icon: Settings },
  {
    to: "/admin",
    label: "Administración",
    hint: "G",
    icon: ShieldCheck,
    systemRoles: ["ADMIN", "SUPER_ADMIN"],
  },
];
