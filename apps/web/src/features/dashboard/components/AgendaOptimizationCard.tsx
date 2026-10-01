import { CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AgendaOptimizationCard({
  disabled = true,
}: {
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative space-y-3")}>
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <CalendarRange className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Optimización de agenda</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Análisis de tu semana y reorganización priorizada con el asistente.
          </p>
        </div>
      </div>

      <Button
        type="button"
        disabled={disabled}
        title={
          disabled
            ? "Se habilita cuando exista un motor de optimización de agenda en el backend"
            : "Analizar agenda"
        }
        className="w-full"
      >
        <Sparkles className="h-4 w-4" />
        Analizar agenda
      </Button>

      <p className="flex items-center gap-1.5 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        Próximamente: se habilitará sin inventar recomendaciones hasta que el
        backend ofrezca una optimización real.
      </p>
    </div>
  );
}
