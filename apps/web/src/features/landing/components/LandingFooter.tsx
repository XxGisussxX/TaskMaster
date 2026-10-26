import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckSquare className="h-4 w-4" />
          <span>
            © {new Date().getFullYear()} TaskMaster. Todos los derechos
            reservados.
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/login" className="hover:text-foreground">
            Iniciar sesión
          </Link>
          <Link to="/register" className="hover:text-foreground">
            Registrarse
          </Link>
        </nav>
      </div>
    </footer>
  );
}
