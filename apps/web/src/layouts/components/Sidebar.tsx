import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/features/workspace/components/WorkspaceSwitcher";
import { NAV_GROUPS, NAV_ITEMS } from "@/app/nav";

function navKey(item: { id?: string; to: string }): string {
  return item.id ?? item.to;
}

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);

  const visible = NAV_ITEMS.filter((item) => {
    if (!item.systemRoles) return true;
    return !!user && item.systemRoles.includes(user.role);
  });

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/70 bg-card transition-all",
        sidebarOpen ? "w-60" : "w-16",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Button
          variant="ghost"
          size="icon"
          className="-translate-x-1 h-10 w-10 shrink-0"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Contraer sidebar" : "Expandir sidebar"}
          title={sidebarOpen ? "Contraer sidebar" : "Expandir sidebar"}
        >
          <img
            src="/assets/images/14.png"
            alt="TaskMaster"
            className="h-9 w-9 object-contain"
          />
        </Button>
        {sidebarOpen && <WorkspaceSwitcher sidebarOpen={sidebarOpen} />}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => {
          const items = visible.filter((item) => item.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="mb-4 last:mb-0">
              {sidebarOpen && (
                <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={navKey(item)}
                    to={item.to}
                    end={item.end}
                    title={sidebarOpen ? undefined : item.label}
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
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
