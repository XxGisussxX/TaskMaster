import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Organiza, prioriza y colabora en un solo lugar
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          Gestiona tus tareas con claridad usando TaskMaster
        </h1>
        <p className="mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
          TaskMaster te ayuda a planificar proyectos, dar seguimiento a tareas
          con un tablero Kanban, tomar notas, recibir recordatorios y trabajar
          en equipo sin perder el enfoque.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => (window.location.href = "/register")}
          >
            Empezar gratis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => (window.location.href = "/login")}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Iniciar sesión
          </Button>
        </div>
      </div>
    </section>
  );
}
