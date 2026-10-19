import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Estado de error reutilizable para cargas de datos.
 *
 * Se separa de `EmptyState` a propósito: un fallo de red no es "no hay datos",
 * y ofrecer el botón de reintentar es lo que evita que el usuario quede varado
 * recargando la página entera.
 */
export function ErrorState({
  title = "Algo salió mal",
  description = "Revisa tu conexión e inténtalo de nuevo",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
