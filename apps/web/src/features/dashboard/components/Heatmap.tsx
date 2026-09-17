import { useMemo, useState } from "react";

const CELL = 11;
const GAP = 3;
const WEEKS = 53;

function level(count: number): number {
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

const LEVEL_COLORS = [
  "var(--color-muted)",
  "oklch(0.78 0.12 262)",
  "oklch(0.68 0.16 262)",
  "oklch(0.58 0.19 262)",
  "oklch(0.48 0.21 262)",
];

export function Heatmap({
  data,
  year,
}: {
  data: { date: string; count: number }[];
  year: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(
    () => new Map(data.map((d) => [d.date, d.count])),
    [data],
  );

  const days = useMemo(() => {
    const result: (string | null)[] = [];
    const first = new Date(year, 0, 1);
    const startDow = first.getDay();
    for (let i = 0; i < startDow; i++) result.push(null);
    const last = new Date(year, 11, 31);
    for (let d = first; d <= last; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
      result.push(key);
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year]);

  const cols = useMemo(() => {
    const colsArr: (string | null)[][] = [];
    for (let i = 0; i < WEEKS; i++) colsArr.push(days.slice(i * 7, i * 7 + 7));
    return colsArr;
  }, [days]);

  const total = useMemo(
    () => data.reduce((acc, d) => acc + d.count, 0),
    [data],
  );

  const selectedInfo = selected
    ? `${selected}: ${byDate.get(selected) ?? 0} tareas`
    : `${total} tareas en ${year}`;

  return (
    <div>
      <div className="flex justify-between text-sm">
        <p className="font-medium">{year}</p>
        <p className="text-muted-foreground">{selectedInfo}</p>
      </div>
      <div className="mt-2 overflow-x-auto">
        <svg
          width={cols.length * (CELL + GAP)}
          height={7 * (CELL + GAP)}
          role="img"
          aria-label={`Mapa de actividad ${year}`}
        >
          {cols.map((week, wi) =>
            week.map((day, di) =>
              day ? (
                <rect
                  key={day}
                  x={wi * (CELL + GAP)}
                  y={di * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={LEVEL_COLORS[level(byDate.get(day) ?? 0)]}
                  opacity={level(byDate.get(day) ?? 0) === 0 ? 0.5 : 1}
                  onMouseEnter={() => setSelected(day)}
                  onMouseLeave={() => setSelected(null)}
                >
                  <title>{`${day}: ${byDate.get(day) ?? 0}`}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <span>Menos</span>
        {LEVEL_COLORS.map((c, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}
