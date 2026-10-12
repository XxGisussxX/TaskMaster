import { AlarmClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgeBucket {
  bucket: string;
  count: number;
}

/** Vencidas agrupadas por antigüedad del vencimiento (buckets del servidor). */
export function OverdueByAgeCard({ data }: { data: AgeBucket[] }) {
  if (data.length === 0) return null;

  const total = data.reduce((acc, bucket) => acc + bucket.count, 0);
  const max = Math.max(1, ...data.map((bucket) => bucket.count));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlarmClock className="h-4 w-4 text-destructive" />
          Vencidas por antigüedad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString("es")} tareas vencidas en total
        </p>
        {data.map((bucket) => (
          <div key={bucket.bucket} className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 text-muted-foreground">
              {bucket.bucket} d
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive"
                style={{ width: `${(bucket.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums">
              {bucket.count.toLocaleString("es")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
