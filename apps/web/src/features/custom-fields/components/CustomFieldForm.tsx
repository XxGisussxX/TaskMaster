import type { CustomFieldDefinition } from "@taskmaster/contracts";
import {
  useCustomFieldDefinitions,
  useCustomFieldValues,
  useSetCustomFieldValue,
} from "../hooks/useCustomFields";
import { CustomFieldRenderer } from "./CustomFieldRenderer";

interface CustomFieldFormProps {
  entityType: string;
  entityId: string;
}

export function CustomFieldForm({
  entityType,
  entityId,
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
    setFieldValue.mutate({
      definitionId: definition.id,
      entityId,
      entityType,
      value: newValue,
    });
  };

  return (
    <div className="space-y-3">
      {definitions.map((def) => (
        <div key={def.id} className="space-y-1">
          <label className="text-sm font-medium">
            {def.name}
            {def.required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <CustomFieldRenderer
            definition={def}
            value={valuesByDefId.get(def.id)}
            onChange={(v) => handleChange(def, v)}
          />
        </div>
      ))}
    </div>
  );
}
