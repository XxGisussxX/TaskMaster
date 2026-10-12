import { useMemo } from "react";
import type { DashboardStats } from "@taskmaster/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const hours = seconds / 3600;
  return hours >= 10
    ? `${Math.round(hours)} h`
    : `${Math.round(hours * 10) / 10} h`;
}

/** Carga y horas por persona. Solo existe en ADM/OWNER (el servicio lo gatea). */
export function PersonLoadCard({
  workload,
  hours,
  currentUserId,
}: {
  workload: NonNullable<DashboardStats["workloadByPerson"]>;
  hours: NonNullable<DashboardStats["hoursByPerson"]>;
  currentUserId?: string;
}) {
  const sorted = useMemo(
    () => [...workload].sort((a, b) => b.activeTasks - a.activeTasks),
    [workload],
  );
  const max = Math.max(1, ...sorted.map((w) => w.activeTasks));
  const hoursByUser = useMemo(
    () => new Map(hours.map((h) => [h.userId, h.seconds])),
    [hours],
  );

  if (sorted.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Carga por persona</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {sorted.map((person) => {
            const seconds = hoursByUser.get(person.userId) ?? 0;
            return (
              <li key={person.userId} className="flex items-center gap-3">
                <Avatar name={person.name} className="h-8 w-8 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {person.name}
                      {person.userId === currentUserId && " (tú)"}
                    </p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {person.activeTasks} activas · {formatSeconds(seconds)}
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          person.overdueTasks > 0
                            ? "bg-destructive"
                            : "bg-primary",
                        )}
                        style={{
                          width: `${Math.round((person.activeTasks / max) * 100)}%`,
                        }}
                      />
                    </div>
                    {person.overdueTasks > 0 && (
                      <span className="shrink-0 text-[11px] tabular-nums text-destructive">
                        {person.overdueTasks} vencidas
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
