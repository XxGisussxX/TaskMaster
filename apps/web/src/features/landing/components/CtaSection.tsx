import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="container mx-auto px-4 py-12 md:py-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center rounded-lg border border-border/70 bg-gradient-to-b from-background to-muted/30 px-6 py-10 text-center md:px-12">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Empieza a organizar tu trabajo hoy
        </h2>
        <p className="mt-3 max-w-xl text-balance text-muted-foreground">
          Crea tu cuenta gratis y empieza a gestionar tareas, equipos y
          proyectos con TaskMaster.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => (window.location.href = "/register")}
          >
            Crear cuenta gratis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => (window.location.href = "/login")}
          >
            Ya tengo una cuenta
          </Button>
        </div>
      </div>
    </section>
  );
}
