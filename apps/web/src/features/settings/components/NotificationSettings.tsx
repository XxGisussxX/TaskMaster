import { Bell, CalendarClock, Mail } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/features/users/hooks/useProfile";

const TIMEZONES = [
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Lima", label: "Lima" },
  { value: "America/Santiago", label: "Santiago" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Montevideo", label: "Montevideo" },
  { value: "America/Caracas", label: "Caracas" },
  { value: "America/Guayaquil", label: "Guayaquil" },
  { value: "America/La_Paz", label: "La Paz" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Santo_Domingo", label: "Santo Domingo" },
  { value: "America/Puerto_Rico", label: "San Juan" },
  { value: "America/New_York", label: "Nueva York" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "UTC", label: "UTC" },
];

const browserTimeZone =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

export function NotificationSettings() {
  const { data: settings, isLoading } = useUserSettings();
  const update = useUpdateUserSettings();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Cargando preferencias...
      </div>
    );
  }

  const emailPrefs = settings?.emailPrefs ?? {};
  const timezone = settings?.timezone ?? browserTimeZone;
  const timezones = TIMEZONES.some((zone) => zone.value === timezone)
    ? TIMEZONES
    : [...TIMEZONES, { value: timezone, label: timezone }];

  const setEmailPref = (key: string, enabled: boolean) => {
    update.mutate({ emailPrefs: { ...emailPrefs, [key]: enabled } });
  };

  return (
    <div className="divide-y">
      <ToggleRow
        icon={Bell}
        label="Recordatorios por email"
        description="Cuando se cumple la fecha de un recordatorio que programaste."
        checked={emailPrefs.reminders !== false}
        disabled={update.isPending}
        onChange={(checked) => setEmailPref("reminders", checked)}
      />
      <ToggleRow
        icon={CalendarClock}
        label="Tareas por vencer"
        description="Un aviso el día antes de que venza una tarea asignada a vos."
        checked={emailPrefs.dueSoon !== false}
        disabled={update.isPending}
        onChange={(checked) => setEmailPref("dueSoon", checked)}
      />
      <ToggleRow
        icon={Mail}
        label="Resumen semanal"
        description="Cada lunes a las 8:00 de tu zona horaria: pendientes, vencidas y completadas."
        checked={settings?.weeklyDigest ?? false}
        disabled={update.isPending}
        onChange={(checked) => update.mutate({ weeklyDigest: checked })}
      />

      <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label htmlFor="notification-timezone">Zona horaria</Label>
          <p className="text-xs text-muted-foreground">
            Define a qué hora sale el resumen semanal.
          </p>
        </div>
        <Select
          id="notification-timezone"
          className="sm:w-64"
          value={timezone}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ timezone: event.target.value })}
        >
          {timezones.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
