import {
  ArrowLeftRight,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Action, ActivityEntry } from "@taskmaster/contracts";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/date";

const ACTION_META: Record<
  Action,
  { label: string; icon: LucideIcon; active: string }
> = {
  CREATED: {
    label: "creó",
    icon: Plus,
    active: "bg-success/10 text-success",
  },
  UPDATED: {
    label: "actualizó",
    icon: Pencil,
    active: "bg-primary/10 text-primary",
  },
  COMPLETED: {
    label: "completó",
    icon: CheckCircle2,
    active: "bg-success/10 text-success",
  },
  REOPENED: {
    label: "reabrió",
    icon: RotateCcw,
    active: "bg-warning/10 text-warning",
  },
  DELETED: {
    label: "eliminó",
    icon: Trash2,
    active: "bg-destructive/10 text-destructive",
  },
  ASSIGNED: {
    label: "asignó",
    icon: UserPlus,
    active: "bg-primary/10 text-primary",
  },
  STATUS_CHANGED: {
    label: "cambió el estado de",
    icon: ArrowLeftRight,
    active: "bg-primary/10 text-primary",
  },
  COMMENTED: {
    label: "comentó en",
    icon: MessageSquare,
    active: "bg-secondary/50 text-secondary-foreground",
  },
};

export function ActivityTimeline({
  entries,
  limit = 8,
}: {
  entries: ActivityEntry[];
  limit?: number;
}) {
  const items = entries.slice(0, limit);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin actividad todavía</p>
    );
  }

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
      {items.map((entry) => {
        const meta = ACTION_META[entry.action];
        const Icon = meta.icon;
        return (
          <li key={entry.id} className="relative flex gap-3 pl-1">
            <div className="relative z-10 mt-0.5 shrink-0">
              {entry.user ? (
                <div className="relative">
                  <Avatar
                    name={entry.user.name}
                    src={entry.user.avatarUrl}
                    className="h-6 w-6 text-[10px]"
                  />
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-card",
                      meta.active,
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                </div>
              ) : (
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full",
                    meta.active,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                {entry.user ? (
                  <span className="font-medium">{entry.user.name} </span>
                ) : null}
                <span className="text-muted-foreground">
                  {meta.label} {entry.entityType.toLowerCase()}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatRelativeTime(entry.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
