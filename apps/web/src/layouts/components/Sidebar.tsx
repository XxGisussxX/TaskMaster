import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  StickyNote,
  CalendarDays,
  Settings,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { Avatar } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tareas", icon: ListTodo, end: false },
  { to: "/notes", label: "Notas", icon: StickyNote, end: false },
  { to: "/calendar", label: "Calendario", icon: CalendarDays, end: false },
  { to: "/settings", label: "Ajustes", icon: Settings, end: false },
];

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const user = useAuthStore((s) => s.user);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all",
        sidebarOpen ? "w-60" : "w-16",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          T
        </div>
        {sidebarOpen && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">TaskMaster</p>
            <p className="truncate text-xs text-muted-foreground">Workspace</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          {sidebarOpen && <span className="flex-1 text-left">Buscar…</span>}
          {sidebarOpen && <kbd className="text-xs">⌘K</kbd>}
        </button>

        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <Avatar name={user?.name ?? "?"} src={user?.avatarUrl} />
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
