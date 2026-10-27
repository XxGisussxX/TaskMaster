import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  id: string;
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
    entryId: string,
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
  const seededRef = useRef(false);
  const qc = useQueryClient();

  // El historial ahora vive en el servidor; al montar se siembra una vez. Las
  // respuestas proactivas y los turnos recién enviados viven solo en memoria
  // hasta el próximo montaje, pero los turnos de `send` ya quedan persistidos.
  const { data: history } = useQuery({
    queryKey: ["ai-chat", workspaceId],
    queryFn: () => aiApi.getChatHistory(workspaceId!),
    enabled: !!workspaceId && !local,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!history || seededRef.current) return;
    seededRef.current = true;
    setEntries(
      history.map((entry) => ({
        id: entry.id,
        role: entry.role,
        text: entry.text,
        actions:
          entry.actions.length > 0
            ? entry.actions.map((action) => ({
                action,
                status: "pending" as const,
              }))
            : undefined,
      })),
    );
  }, [history]);

  const nextId = () => `local-${++idRef.current}`;

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
    async (entryId: string, action: AssistantAction, actionIndex: number) => {
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
        const invalidateTaskViews = () => {
          void qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
          void qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
          void qc.invalidateQueries({ queryKey: ["notifications"] });
        };

        switch (action.kind) {
          case "complete": {
            await tasksApi.update(workspaceId, action.taskId, {
              status: "DONE",
            });
            toast.success(`"${action.taskTitle}" marcada como completada`);
            invalidateTaskViews();
            break;
          }
          case "complete-many": {
            const ids = action.tasks.map((task) => task.taskId);
            await tasksApi.bulkUpdateStatus(workspaceId, ids, "DONE");
            toast.success(`${ids.length} tareas completadas`);
            invalidateTaskViews();
            break;
          }
          case "delete": {
            await tasksApi.remove(workspaceId, action.taskId);
            toast.success(`"${action.taskTitle}" eliminada`);
            invalidateTaskViews();
            break;
          }
          case "delete-many": {
            const ids = action.tasks.map((task) => task.taskId);
            await tasksApi.bulkDelete(workspaceId, ids);
            toast.success(`${ids.length} tareas eliminadas`);
            invalidateTaskViews();
            break;
          }
          case "create": {
            const { subtasks, ...draft } = action.draft;
            const created = await tasksApi.create(workspaceId, {
              ...draft,
              dueDate: draft.dueDate || null,
              startDate: draft.startDate || null,
              channelId: draft.channelId || null,
            });
            for (const title of subtasks) {
              await tasksApi.createSubtask(workspaceId, created.id, title);
            }
            toast.success(`Tarea "${action.draft.title}" creada`);
            invalidateTaskViews();
            break;
          }
          case "reminder": {
            await remindersApi.create(workspaceId, {
              title: action.title,
              triggerAt: action.triggerAt,
              taskId: action.taskId ?? null,
            });
            toast.success("Recordatorio creado");
            void qc.invalidateQueries({ queryKey: ["reminders", workspaceId] });
            break;
          }
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
        const failure =
          action.kind === "complete" || action.kind === "complete-many"
            ? "No se pudo completar la tarea"
            : action.kind === "delete" || action.kind === "delete-many"
              ? "No se pudo eliminar la tarea"
              : action.kind === "create"
                ? "No se pudo crear la tarea"
                : "No se pudo crear el recordatorio";
        toast.error(failure, {
          description:
            cause instanceof Error ? cause.message : "Intentalo de nuevo.",
        });
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
    if (workspaceId && !local) {
      void aiApi
        .clearChatHistory(workspaceId)
        .then(() =>
          qc.invalidateQueries({ queryKey: ["ai-chat", workspaceId] }),
        )
        .catch(() => toast.error("No se pudo borrar el historial"));
    }
  }, [workspaceId, local, qc]);

  return { entries, sending, error, send, execute, pushProactive, reset };
}
