import { useMemo } from "react";
import { formatDate } from "@taskmaster/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeekPoint {
  weekStart: string;
  created: number;
  completed: number;
}

/** Throughput semanal (series agregadas por semana, lunes como inicio). */
export function ThroughputCard({ data }: { data: WeekPoint[] }) {
  const last = useMemo(() => data.slice(-14), [data]);
  const max = Math.max(1, ...last.flatMap((w) => [w.created, w.completed]));

  if (last.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">
          Creadas vs completadas (semanal)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {last.map((week) => (
            <li
              key={week.weekStart}
              className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs"
            >
              <span className="truncate text-muted-foreground">
                {formatDate(week.weekStart, { day: "numeric", month: "short" })}
              </span>
              <div className="flex h-2 items-stretch gap-0.5 overflow-hidden rounded-sm bg-muted/50">
                <div
                  className="h-full rounded-sm bg-primary"
                  style={{ width: `${(week.created / max) * 100}%` }}
                />
                <div
                  className="h-full flex-1 rounded-sm bg-success"
                  style={{ width: `${(week.completed / max) * 100}%` }}
                />
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {week.created}/{week.completed}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
