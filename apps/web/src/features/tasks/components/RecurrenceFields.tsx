import { RecurrenceFrequency } from "@taskmaster/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: RecurrenceFrequency.DAILY, label: "Diario" },
  { value: RecurrenceFrequency.WEEKLY, label: "Semanal" },
  { value: RecurrenceFrequency.MONTHLY, label: "Mensual" },
  { value: RecurrenceFrequency.YEARLY, label: "Anual" },
];

export function RecurrenceFields({
  frequency,
  interval,
  endDate,
  onChange,
}: {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate: string;
  onChange: (data: {
    frequency: RecurrenceFrequency;
    interval: number;
    endDate: string;
  }) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label htmlFor="recurrence-frequency">Frecuencia</Label>
        <Select
          id="recurrence-frequency"
          value={frequency}
          onChange={(e) =>
            onChange({
              frequency: e.target.value as RecurrenceFrequency,
              interval,
              endDate,
            })
          }
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="recurrence-interval">Cada</Label>
        <Input
          id="recurrence-interval"
          type="number"
          min={1}
          max={365}
          value={interval}
          onChange={(e) =>
            onChange({
              frequency,
              interval: Math.max(1, parseInt(e.target.value, 10) || 1),
              endDate,
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recurrence-endDate">Fin (opcional)</Label>
        <Input
          id="recurrence-endDate"
          type="date"
          value={endDate}
          onChange={(e) =>
            onChange({ frequency, interval, endDate: e.target.value })
          }
        />
      </div>
    </div>
  );
}
