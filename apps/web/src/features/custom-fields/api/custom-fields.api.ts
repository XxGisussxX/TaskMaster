import type {
  CustomFieldDefinition,
  CustomFieldValue,
  CreateCustomFieldDefinitionInput,
  UpdateCustomFieldDefinitionInput,
} from "@taskmaster/contracts";
import { http } from "@/services/http";

export const customFieldsApi = {
  listDefinitions: (workspaceId: string) =>
    http.get<CustomFieldDefinition[]>(
      `/workspaces/${workspaceId}/custom-fields`,
    ),

  createDefinition: (
    workspaceId: string,
    input: CreateCustomFieldDefinitionInput,
  ) =>
    http.post<CustomFieldDefinition>(
      `/workspaces/${workspaceId}/custom-fields`,
      input,
    ),

  updateDefinition: (
    workspaceId: string,
    id: string,
    input: UpdateCustomFieldDefinitionInput,
  ) =>
    http.patch<CustomFieldDefinition>(
      `/workspaces/${workspaceId}/custom-fields/${id}`,
      input,
    ),

  removeDefinition: (workspaceId: string, id: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/custom-fields/${id}`),

  setValue: (
    workspaceId: string,
    input: {
      definitionId: string;
      entityId: string;
      entityType: string;
      value: unknown;
    },
  ) =>
    http.put<CustomFieldValue>(
      `/workspaces/${workspaceId}/custom-fields/values`,
      input,
    ),

  getValues: (workspaceId: string, entityType: string, entityId: string) => {
    const params = new URLSearchParams({ entityType, entityId });
    return http.get<CustomFieldValue[]>(
      `/workspaces/${workspaceId}/custom-fields/values?${params.toString()}`,
    );
  },
};
