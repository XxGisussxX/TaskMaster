import { useNavigate } from "react-router-dom";
import { Moon, Sun, LogOut, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/features/auth/api/auth.api";

export function Header() {
  const navigate = useNavigate();
  const { toggleSidebar, setTheme, theme, setCommandPaletteOpen } =
    useUiStore();
  const { user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Alternar sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <kbd className="rounded border px-1 text-xs">N</kbd>
          <span>Nueva tarea</span>
        </Button>
      </div>

      <div className="flex items-center gap-1">
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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          title={`${user?.name ?? ""} — cerrar sesión`}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
