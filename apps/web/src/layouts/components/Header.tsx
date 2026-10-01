import { Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui.store";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { UserMenu } from "./UserMenu";

export function Header() {
  const { setTheme, theme, setCommandPaletteOpen } = useUiStore();

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border/70 bg-card px-4">
      <button
        type="button"
        aria-label="Buscar en el espacio de trabajo"
        onClick={() => setCommandPaletteOpen(true)}
        className="group flex h-9 min-w-0 max-w-sm flex-1 items-center gap-2 rounded-md border border-input/80 bg-transparent px-3 text-left text-sm text-muted-foreground transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Buscar tareas y notas...
        </span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Ctrl K
        </kbd>
      </button>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tema"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
