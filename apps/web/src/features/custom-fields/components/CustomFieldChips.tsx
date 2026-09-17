import { CustomFieldType } from "@taskmaster/contracts";
import type { CustomFieldValue } from "@taskmaster/contracts";
import { cn } from "@/lib/utils";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatDisplayValue(value: CustomFieldValue): string {
  const { definition } = value;
  if (!definition) return "—";
  const raw = value.value;

  switch (definition.type) {
    case CustomFieldType.CHECKBOX:
      return raw ? "✓" : "—";
    case CustomFieldType.MULTI_SELECT:
      return Array.isArray(raw) && raw.length > 0
        ? (raw as string[]).join(", ")
        : "—";
    case CustomFieldType.DATE: {
      if (typeof raw !== "string" || !raw) return "—";
      const [y, m, d] = raw.split("-").map(Number);
      if (!y || !m || !d) return raw;
      return `${d} ${MONTHS[m - 1]} ${y}`;
    }
    default:
      return raw === undefined || raw === null || raw === ""
        ? "—"
        : String(raw);
  }
}

export function CustomFieldChips({
  values,
  max = 3,
  className,
}: {
  values?: CustomFieldValue[];
  max?: number;
  className?: string;
}) {
  if (!values || values.length === 0) return null;
  const visible = values.slice(0, max);
  const hidden = values.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((value) => (
        <span
          key={value.id}
          className="inline-flex max-w-[180px] items-center gap-1 truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
          title={`${value.definition?.name ?? ""}: ${formatDisplayValue(value)}`}
        >
          <span className="font-medium text-muted-foreground">
            {value.definition?.name}:
          </span>
          <span className="truncate">{formatDisplayValue(value)}</span>
        </span>
      ))}
      {hidden > 0 && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          +{hidden}
        </span>
      )}
    </div>
  );
}
