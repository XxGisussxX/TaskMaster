import { http } from "@/services/http";
import type {
  AiUsage,
  AssistantMessage,
  AssistantResponse,
  NlTaskDraft,
} from "@taskmaster/contracts";

export const aiApi = {
  generateTaskDraft: (workspaceId: string, text: string) =>
    http.post<NlTaskDraft>(`/workspaces/${workspaceId}/ai/nl-task`, { text }),
  assistant: (
    workspaceId: string,
    body: { messages: AssistantMessage[]; text: string },
  ) =>
    http.post<AssistantResponse>(
      `/workspaces/${workspaceId}/ai/assistant`,
      body,
    ),
  getUsage: (workspaceId: string) =>
    http.get<AiUsage>(`/workspaces/${workspaceId}/ai/usage`),
};
