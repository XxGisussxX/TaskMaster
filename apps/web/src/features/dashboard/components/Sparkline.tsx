import { useId } from "react";

const WIDTH = 70;
const HEIGHT = 32;
const PAD = 2.5;

type Point = readonly [number, number];

function toPath(points: Point[]): string {
  if (points.length < 2) return "";
  const format = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let d = `M${format(points[0]!)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${format(p2)}`;
  }
  return d;
}

export function Sparkline({
  values,
  color,
  label,
  className,
}: {
  values: number[];
  color: string;
  label?: string;
  className?: string;
}) {
  const gradientId = useId();

  const max = Math.max(1, ...values);
  const chartW = WIDTH - PAD * 2;
  const chartH = HEIGHT - PAD * 2;
  const x = (i: number) =>
    values.length <= 1 ? WIDTH / 2 : PAD + (i / (values.length - 1)) * chartW;
  const y = (v: number) => PAD + (1 - v / max) * chartH;
  const baseline = y(0);

  const points: Point[] = values.map((v, i) => [x(i), y(v)]);
  const line = toPath(points);
  const first = points[0];
  const last = points[points.length - 1];

  if (!first || !last) {
    return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} />;
  }

  const area = `${line} L${last[0].toFixed(1)},${baseline.toFixed(1)} L${first[0].toFixed(1)},${baseline.toFixed(1)} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && <path d={area} fill={`url(#${gradientId})`} />}
      {values.length > 1 && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}
