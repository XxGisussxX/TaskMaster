import { TaskStatus } from "@taskmaster/contracts";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_META: Record<
  TaskStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  [TaskStatus.TODO]: { label: "Por hacer", variant: "outline" },
  [TaskStatus.IN_PROGRESS]: { label: "En curso", variant: "default" },
  [TaskStatus.IN_REVIEW]: { label: "En revisión", variant: "warning" },
  [TaskStatus.DONE]: { label: "Completada", variant: "success" },
  [TaskStatus.ARCHIVED]: { label: "Archivada", variant: "secondary" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
