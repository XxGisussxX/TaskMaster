import type { CustomFieldDefinition } from "@taskmaster/contracts";
import { parseCustomFieldValue } from "@taskmaster/contracts";
import {
  useCustomFieldDefinitions,
  useCustomFieldValues,
  useSetCustomFieldValue,
} from "../hooks/useCustomFields";
import { CustomFieldRenderer } from "./CustomFieldRenderer";

interface CustomFieldFormProps {
  entityType: string;
  entityId: string;
  readOnly?: boolean;
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function fieldError(
  definition: CustomFieldDefinition,
  value: unknown,
): string | null {
  if (isBlank(value)) {
    return definition.required
      ? `El campo «${definition.name}» es requerido`
      : null;
  }
  const outcome = parseCustomFieldValue({
    def: {
      type: definition.type,
      required: definition.required,
      options: definition.options ?? [],
    },
    label: definition.name,
    value,
  });
  return outcome.success ? null : outcome.message;
}

export function CustomFieldForm({
  entityType,
  entityId,
  readOnly = false,
}: CustomFieldFormProps) {
  const { data: definitions } = useCustomFieldDefinitions();
  const { data: values } = useCustomFieldValues(entityType, entityId);
  const setFieldValue = useSetCustomFieldValue();

  if (!definitions || definitions.length === 0) return null;

  const valuesByDefId = new Map(
    (values ?? []).map((v) => [v.definitionId, v.value]),
  );

  const handleChange = (
    definition: CustomFieldDefinition,
    newValue: unknown,
  ) => {
    if (readOnly) return;
    setFieldValue.mutate({
      definitionId: definition.id,
      entityId,
      entityType,
      value: newValue,
    });
  };

  return (
    <div className="space-y-3">
      {definitions.map((def) => {
        const value = valuesByDefId.get(def.id);
        const error = fieldError(def, value);
        return (
          <div key={def.id} className="space-y-1">
            <label className="text-sm font-medium">
              {def.name}
              {def.required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <CustomFieldRenderer
              definition={def}
              value={value}
              onChange={readOnly ? undefined : (v) => handleChange(def, v)}
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
