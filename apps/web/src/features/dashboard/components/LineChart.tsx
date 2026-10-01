import { useId } from "react";

export interface SeriesPoint {
  date: string;
  created: number;
  completed: number;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };

export function LineChart({ series }: { series: SeriesPoint[] }) {
  const gradientId = useId();

  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sin datos en el periodo
      </div>
    );
  }

  const maxValue = Math.max(
    1,
    ...series.flatMap((p) => [p.created, p.completed]),
  );
  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, series.length - 1)) * chartW;
  const y = (v: number) => PAD.top + chartH - (v / maxValue) * chartH;

  const createdPath = series
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.created).toFixed(1)}`,
    )
    .join(" ");
  const completedPath = series
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.completed).toFixed(1)}`,
    )
    .join(" ");
  const completedArea = `${completedPath} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const gridLines = Math.min(4, maxValue);
  const yTicks = Array.from(
    { length: gridLines + 1 },
    (_, i) => (maxValue / gridLines) * i,
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Tareas creadas y completadas por día"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
          <text
            x={PAD.left - 6}
            y={y(tick) + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {Math.round(tick)}
          </text>
        </g>
      ))}

      <path
        d={`${createdPath} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
        fill={`url(#${gradientId})`}
        className="text-primary"
      />
      <path d={completedArea} fill="var(--color-success)" fillOpacity="0.06" />
      <path
        d={createdPath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
      />
      <path
        d={completedPath}
        fill="none"
        stroke="var(--color-success)"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <circle
        cx={x(series.length - 1)}
        cy={y(series[series.length - 1]?.created ?? 0)}
        r="3"
        fill="var(--color-primary)"
      />
      <circle
        cx={x(series.length - 1)}
        cy={y(series[series.length - 1]?.completed ?? 0)}
        r="3"
        fill="var(--color-success)"
      />

      <text
        x={PAD.left}
        y={HEIGHT - 6}
        className="fill-muted-foreground text-[10px]"
      >
        {series[0]?.date}
      </text>
      <text
        x={WIDTH - PAD.right}
        y={HEIGHT - 6}
        textAnchor="end"
        className="fill-muted-foreground text-[10px]"
      >
        {series[series.length - 1]?.date}
      </text>
    </svg>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" /> Creadas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success" /> Completadas
      </span>
    </div>
  );
}
