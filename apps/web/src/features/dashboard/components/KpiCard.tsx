import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

const ACCENT_STYLES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/20 text-warning-foreground",
} as const;

const SPARK_COLORS: Record<keyof typeof ACCENT_STYLES, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  danger: "var(--color-destructive)",
  warning: "var(--color-warning)",
};

const CARD_GLOWS: Record<keyof typeof ACCENT_STYLES, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  danger: "var(--color-destructive)",
  warning: "var(--color-warning)",
};

type Accent = keyof typeof ACCENT_STYLES;

export function KpiCard({
  label,
  value,
  hint,
  sparkline,
  icon: Icon,
  accent = "primary",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  sparkline?: number[];
  icon: LucideIcon;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative p-4 transition-shadow hover:shadow-md",
        className,
      )}
      style={{
        background: `radial-gradient(circle at 100% 100%, color-mix(in oklch, ${CARD_GLOWS[accent]} 9%, transparent), transparent 36%), var(--card)`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("rounded-md p-1.5", ACCENT_STYLES[accent])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {sparkline && sparkline.length > 0 && (
        <Sparkline
          values={sparkline}
          color={SPARK_COLORS[accent]}
          label={`Tendencia de ${label}`}
          className="pointer-events-none absolute bottom-3 right-3 h-8 w-[70px]"
        />
      )}
    </Card>
  );
}
