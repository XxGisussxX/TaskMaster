import { CalendarRange, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgendaReview } from "../hooks/useAgendaReview";
import type { AgendaFinding } from "@taskmaster/contracts";

const KIND_LABEL: Record<AgendaFinding["kind"], string> = {
  OVERLAP: "Se pisan",
  OVERLOAD: "Día sobrecargado",
  STALE_REVIEW: "Atascada en revisión",
  UNFLAGGED_OVERDUE: "Vencida sin escalar",
};

const SEVERITY_STYLES = [
  "border-destructive/40 bg-destructive/5",
  "border-warning/40 bg-warning/5",
  "border-muted-foreground/20 bg-muted/40",
];

/**
 * Diagnóstico de agenda del usuario.
 *
 * No hay botón ni estado "próximamente": lo que hay son hallazgos que el backend
 * calculó, o la constatación de que no hay ninguno. Ese caso vacío es un
 * resultado real y por eso vale más que un botón deshabilitado, que además
 * dejaba sin explicar por qué no se podía usar.
 */
export function AgendaOptimizationCard() {
  const { data, isLoading, isError } = useAgendaReview();

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4" /> Optimización de agenda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Tu semana, en números</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Solapamientos, días con sobrecarga y vencidas sin escalar,
              calculados sobre tus tareas reales.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Revisando tus tareas abiertas…
          </p>
        ) : isError ? (
          <p className="text-xs text-muted-foreground">
            No se pudo calcular la revisión de agenda.
          </p>
        ) : !data ? (
          <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p className="text-xs leading-relaxed">
              No tenés tareas abiertas para revisar.
            </p>
          </div>
        ) : data.findings.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p className="text-xs leading-relaxed">
              Nada que corregir: no hay solapamientos, ni días sobrecargados, ni
              vencidas sin escalar.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.findings.slice(0, 6).map((finding, index) => (
              <li
                key={`${finding.kind}-${finding.taskIds.join("-")}-${index}`}
                className={`rounded-md border px-3 py-2 text-xs ${SEVERITY_STYLES[Math.min(finding.severity, SEVERITY_STYLES.length - 1)]}`}
              >
                <span className="font-medium">{KIND_LABEL[finding.kind]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {finding.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {data && data.overloadedDays.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Días con sobrecarga:{" "}
            {data.overloadedDays
              .map((day) => `${day.date} (${day.count})`)
              .join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
