import { NavLink } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/features/workspace/components/WorkspaceSwitcher";
import { NAV_ITEMS } from "@/app/nav";

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);

  const navItems = NAV_ITEMS.filter((item) => {
    if (!item.systemRoles) return true;
    return !!user && item.systemRoles.includes(user.role);
  });

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-card transition-all",
        sidebarOpen ? "w-60" : "w-16",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Contraer sidebar" : "Expandir sidebar"}
          title={sidebarOpen ? "Contraer sidebar" : "Expandir sidebar"}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        {sidebarOpen && <WorkspaceSwitcher sidebarOpen={sidebarOpen} />}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
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
