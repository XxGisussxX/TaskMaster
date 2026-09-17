import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useUiStore } from "@/store/ui.store";
import { useAuthStore } from "@/store/auth.store";
import { logout } from "@/features/auth/api/auth.api";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

export function Header() {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { setTheme, theme } = useUiStore();
  const { user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="flex h-14 items-center justify-end bg-card px-4">
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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          title={`${user?.name ?? ""} — cerrar sesión`}
          onClick={() => setConfirmOpen(true)}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cerrar sesión"
        description="¿Estás seguro de que quieres cerrar sesión?"
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLogout}>Cerrar sesión</Button>
        </div>
      </Dialog>
    </header>
  );
}
