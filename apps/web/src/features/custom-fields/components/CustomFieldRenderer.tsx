import type { CustomFieldDefinition } from "@taskmaster/contracts";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomFieldType } from "@taskmaster/contracts";

interface CustomFieldRendererProps {
  definition: CustomFieldDefinition;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function CustomFieldRenderer({
  definition,
  value,
  onChange,
}: CustomFieldRendererProps) {
  const readOnly = !onChange;
  const options = definition.options ?? [];

  switch (definition.type) {
    case CustomFieldType.TEXT:
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={definition.name}
        />
      );

    case CustomFieldType.NUMBER:
      return (
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange?.(Number(e.target.value))}
          readOnly={readOnly}
          placeholder={definition.name}
        />
      );

    case CustomFieldType.DATE:
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
        />
      );

    case CustomFieldType.SELECT:
      return (
        <Select
          value={(value as string) ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
        >
          <option value="">Seleccionar...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );

    case CustomFieldType.MULTI_SELECT: {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      if (readOnly) {
        return (
          <span className="text-sm text-muted-foreground">
            {selected.length > 0 ? selected.join(", ") : "—"}
          </span>
        );
      }
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={selected.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, opt]
                    : selected.filter((s) => s !== opt);
                  onChange?.(next);
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }

    case CustomFieldType.CHECKBOX:
      return (
        <Checkbox
          checked={!!value}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={readOnly}
        />
      );

    default:
      return null;
  }
}
