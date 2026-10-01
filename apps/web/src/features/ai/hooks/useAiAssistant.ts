import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AssistantAction } from "@taskmaster/contracts";
import { aiApi } from "../api/ai.api";
import { tasksApi } from "@/features/tasks/api/tasks.api";
import { remindersApi } from "@/features/reminders/api/reminders.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";

export type ActionStatus = "pending" | "running" | "done";

export interface AssistantActionItem {
  action: AssistantAction;
  status: ActionStatus;
}

export interface AssistantChatEntry {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantActionItem[];
}

export interface AssistantController {
  entries: AssistantChatEntry[];
  sending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  execute: (
    entryId: number,
    action: AssistantAction,
    actionIndex: number,
  ) => Promise<void>;
  pushProactive: (text: string) => void;
  reset: () => void;
}

const HISTORY_LIMIT = 20;

export function useAiAssistant(): AssistantController {
  const workspaceId = useCurrentWorkspaceId();
  const local = !workspaceId || isLocalWorkspace(workspaceId);
  const [entries, setEntries] = useState<AssistantChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const idRef = useRef(0);
  const qc = useQueryClient();

  const nextId = () => ++idRef.current;

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!workspaceId || local || sending || !text) return;

      const history = entriesRef.current
        .filter((entry) => entry.role === "assistant" || entry.role === "user")
        .slice(-HISTORY_LIMIT)
        .map((entry) => ({ role: entry.role, text: entry.text }));

      setEntries((prev) => [...prev, { id: nextId(), role: "user", text }]);
      setSending(true);
      setError(null);

      try {
        const res = await aiApi.assistant(workspaceId, {
          messages: history,
          text,
        });
        setEntries((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            text: res.reply,
            actions: res.actions.map((action) => ({
              action,
              status: "pending" as const,
            })),
          },
        ]);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo contactar al asistente. Intentalo de nuevo.",
        );
      } finally {
        setSending(false);
      }
    },
    [workspaceId, local, sending],
  );

  const execute = useCallback(
    async (entryId: number, action: AssistantAction, actionIndex: number) => {
      if (!workspaceId) return;

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                actions: entry.actions?.map((item, index) =>
                  index === actionIndex ? { ...item, status: "running" } : item,
                ),
              }
            : entry,
        ),
      );

      try {
        if (action.kind === "complete") {
          await tasksApi.update(workspaceId, action.taskId, {
            status: "DONE",
          });
          toast.success(`"${action.taskTitle}" marcada como completada`);
          void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
          void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
          void qc.invalidateQueries({ queryKey: ["notifications"] });
        } else {
          await remindersApi.create(workspaceId, {
            title: action.title,
            triggerAt: action.triggerAt,
            taskId: action.taskId ?? null,
          });
          toast.success("Recordatorio creado");
          void qc.invalidateQueries({ queryKey: ["reminders", workspaceId] });
        }

        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  actions: entry.actions?.map((item, index) =>
                    index === actionIndex ? { ...item, status: "done" } : item,
                  ),
                }
              : entry,
          ),
        );
      } catch (cause) {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  actions: entry.actions?.map((item, index) =>
                    index === actionIndex
                      ? { ...item, status: "pending" }
                      : item,
                  ),
                }
              : entry,
          ),
        );
        toast.error(
          action.kind === "complete"
            ? "No se pudo completar la tarea"
            : "No se pudo crear el recordatorio",
          {
            description:
              cause instanceof Error ? cause.message : "Intentalo de nuevo.",
          },
        );
      }
    },
    [workspaceId, qc],
  );

  const pushProactive = useCallback((text: string) => {
    setEntries((prev) => [...prev, { id: nextId(), role: "assistant", text }]);
  }, []);

  const reset = useCallback(() => {
    setEntries([]);
    setError(null);
  }, []);

  return { entries, sending, error, send, execute, pushProactive, reset };
}
