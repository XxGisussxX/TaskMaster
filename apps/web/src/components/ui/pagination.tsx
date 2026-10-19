import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Controles de paginación reutilizables.
 *
 * No renderiza nada cuando hay una sola página: mostrar "Página 1 de 1" solo
 * agrega ruido en la mayoría de los listados.
 */
export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación"
      className={cn("flex items-center justify-between", className)}
    >
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
        {typeof total === "number" ? ` · ${total} en total` : ""}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
