import { http } from "@/services/http";
import type {
  AiCapabilities,
  AiChatEntry,
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
  getCapabilities: (workspaceId: string) =>
    http.get<AiCapabilities>(`/workspaces/${workspaceId}/ai/capabilities`),
  getUsage: (workspaceId: string) =>
    http.get<AiUsage>(`/workspaces/${workspaceId}/ai/usage`),
  getChatHistory: (workspaceId: string) =>
    http.get<AiChatEntry[]>(`/workspaces/${workspaceId}/ai/chat`),
  clearChatHistory: (workspaceId: string) =>
    http.delete(`/workspaces/${workspaceId}/ai/chat`),
};
