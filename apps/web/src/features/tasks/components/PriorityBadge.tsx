import { Priority } from "@taskmaster/contracts";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_META: Record<
  Priority,
  { label: string; variant: BadgeProps["variant"] }
> = {
  [Priority.URGENT]: { label: "Urgente", variant: "destructive" },
  [Priority.HIGH]: { label: "Alta", variant: "warning" },
  [Priority.MEDIUM]: { label: "Media", variant: "secondary" },
  [Priority.LOW]: { label: "Baja", variant: "outline" },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge variant={meta.variant} className={cn(className)}>
      {meta.label}
    </Badge>
  );
}
