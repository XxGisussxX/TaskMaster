import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { rangeFromPreset, type DateRange } from "../lib/dashboardStats";

const PRESETS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
  { label: "6 meses", days: 180 },
  { label: "1 año", days: 365 },
];

/**
 * Selector de rango del dashboard: deslizadores Desde/Hasta (YYYY-MM-DD) y
 * presets que terminan hoy. El rango va en la misma query del dashboard (un
 * solo request + invalidación por socket al prefijo `["dashboard", wsId]`).
 */
export function DashboardRangeSelector({
  value,
  onChange,
  disabled,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="grid gap-1">
        <Label htmlFor="dash-from" className="text-xs">
          Desde
        </Label>
        <input
          id="dash-from"
          type="date"
          value={value.from}
          disabled={disabled}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="dash-to" className="text-xs">
          Hasta
        </Label>
        <input
          id="dash-to"
          type="date"
          value={value.to}
          disabled={disabled}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map((preset) => {
          const active = rangeFromPreset(preset.days);
          const isActive = active.from === value.from && active.to === value.to;
          return (
            <Button
              key={preset.days}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              disabled={disabled}
              onClick={() => onChange(rangeFromPreset(preset.days))}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
