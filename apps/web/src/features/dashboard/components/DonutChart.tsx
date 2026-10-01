import { Priority } from "@taskmaster/contracts";

const COLORS: Record<Priority, string> = {
  [Priority.URGENT]: "var(--color-destructive)",
  [Priority.HIGH]: "var(--color-warning)",
  [Priority.MEDIUM]: "var(--color-primary)",
  [Priority.LOW]: "var(--color-muted-foreground)",
};

const LABELS: Record<Priority, string> = {
  [Priority.URGENT]: "Urgente",
  [Priority.HIGH]: "Alta",
  [Priority.MEDIUM]: "Media",
  [Priority.LOW]: "Baja",
};

const SIZE = 160;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

export function DonutChart({ data }: { data: Record<Priority, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sin tareas
      </div>
    );
  }

  let offset = 0;
  const arcs = (Object.keys(Priority) as Priority[]).map((p) => {
    const fraction = data[p] / total;
    const start = offset;
    offset += fraction;
    return { priority: p, fraction, start, value: data[p] };
  });

  const circumference = 2 * Math.PI * R;

  return (
    <div className="flex min-h-56 w-full flex-1 items-center justify-center gap-6">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-44 w-44 shrink-0 xl:h-52 xl:w-52"
        role="img"
        aria-label="Distribución por prioridad"
      >
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
        />
        {arcs
          .filter((a) => a.fraction > 0)
          .map((a) => (
            <circle
              key={a.priority}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={COLORS[a.priority]}
              strokeWidth={STROKE}
              strokeDasharray={`${a.fraction * circumference} ${circumference}`}
              strokeDashoffset={-a.start * circumference}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          ))}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="fill-foreground text-2xl font-bold"
        >
          {total}
        </text>
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          tareas
        </text>
      </svg>

      <ul className="space-y-1 text-sm">
        {(Object.keys(Priority) as Priority[]).map((p) => (
          <li
            key={p}
            className="flex items-center gap-2 rounded-md px-2 py-1"
            style={{
              backgroundColor: `color-mix(in oklch, ${COLORS[p]} 10%, transparent)`,
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[p] }}
            />
            <span className="text-muted-foreground">{LABELS[p]}</span>
            <span className="ml-auto font-semibold">{data[p]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
