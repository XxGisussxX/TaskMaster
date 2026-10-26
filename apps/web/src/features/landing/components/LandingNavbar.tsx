import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span>TaskMaster</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = "/login")}
          >
            Iniciar sesión
          </Button>
          <Button
            size="sm"
            onClick={() => (window.location.href = "/register")}
          >
            Empezar gratis
          </Button>
        </nav>
      </div>
    </header>
  );
}
