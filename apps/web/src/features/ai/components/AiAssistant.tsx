import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { isLocalWorkspace } from "@/features/tasks/lib/localTasks";
import { useUiStore } from "@/store/ui.store";
import { useDashboardStats } from "@/features/dashboard/hooks/useDashboard";
import { useAiUsage } from "../hooks/useAiUsage";
import { useAiCapabilities } from "../hooks/useAiCapabilities";
import { useTypewriter } from "../hooks/useTypewriter";
import { pickPhrase, buildProactiveMessage } from "../lib/assistantScript";
import {
  type AssistantActionItem,
  type AssistantController,
  useAiAssistant,
} from "../hooks/useAiAssistant";

const PROACTIVE_IDLE_MS = 90_000;
const PROACTIVE_TICK_MS = 15_000;

export function AiAssistant() {
  const workspaceId = useCurrentWorkspaceId();
  const local = !workspaceId || isLocalWorkspace(workspaceId);
  const capabilities = useAiCapabilities();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const assistant = useAiAssistant();
  const assistantDraft = useUiStore((s) => s.assistantDraft);
  const consumeAssistantDraft = useUiStore((s) => s.consumeAssistantDraft);

  useEffect(() => {
    if (!assistantDraft || local) return;
    consumeAssistantDraft();
    setDraft(assistantDraft);
    setOpen(true);
  }, [assistantDraft, local, consumeAssistantDraft]);

  // Sin proveedor configurado el orbe se oculta entero, en vez de quedar
  // deshabilitado: un control que no se puede usar ocupa espacio y hace que la
  // app parezca rota. `null` es "todavía consultando" y en ese frame tampoco se
  // dibuja, para que no aparezca y desaparezca. Ajustes explica qué variable
  // falta cuando esto está oculto.
  if (local || capabilities?.configured !== true) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <AiAssistantPanel
          assistant={assistant}
          onClose={() => setOpen(false)}
          draft={draft}
        />
      ) : (
        <Button
          type="button"
          size="icon"
          className="group h-14 w-14 rounded-full bg-transparent shadow-lg hover:bg-transparent"
          aria-label="Abrir asistente"
          onClick={() => setOpen(true)}
        >
          <img
            src="/assets/images/5.png"
            alt=""
            className="h-10 w-10 object-contain transition-transform duration-200 ease-out group-hover:scale-110"
          />
        </Button>
      )}
    </div>
  );
}

function AiAssistantPanel({
  assistant,
  onClose,
  draft,
}: {
  assistant: AssistantController;
  onClose: () => void;
  draft: string | null;
}) {
  const { entries, sending, error, send, execute, pushProactive } = assistant;
  const [welcomeText] = useState(pickPhrase("welcome"));
  const [text, setText] = useState(draft ?? "");

  useEffect(() => {
    if (draft) setText(draft);
  }, [draft]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: usage } = useAiUsage();
  const { data: dashboard } = useDashboardStats();
  const lastActivityRef = useRef(Date.now());
  const proactiveFiredRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, sending, scrollToBottom]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    proactiveFiredRef.current = false;
  }, []);

  useEffect(() => {
    if (!dashboard?.kpis) return;
    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (proactiveFiredRef.current || sending || idle < PROACTIVE_IDLE_MS) {
        return;
      }
      proactiveFiredRef.current = true;
      pushProactive(
        buildProactiveMessage({
          activeTasks: dashboard.kpis.activeTasks,
          overdueTasks: dashboard.kpis.overdueTasks,
          completedToday: dashboard.kpis.completedToday,
        }),
      );
    }, PROACTIVE_TICK_MS);
    return () => clearInterval(tick);
  }, [dashboard, sending, pushProactive]);

  function handleSend() {
    const value = text.trim();
    if (!value || sending || exhausted) return;
    markActivity();
    setText("");
    void send(value);
  }

  function handleExecute(
    entryId: string,
    action: AssistantActionItem["action"],
    index: number,
  ) {
    markActivity();
    void execute(entryId, action, index);
  }

  const exhausted = usage ? usage.usedToday >= usage.dailyLimit : false;
  let lastAssistantId = "";
  for (const entry of entries) {
    if (entry.role === "assistant") lastAssistantId = entry.id;
  }

  return (
    <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border-border border bg-card text-card-foreground shadow-xl sm:w-96">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <img
            src="/assets/images/5.png"
            alt=""
            className="h-6 w-6 object-contain"
          />
          <span className="text-sm font-medium">Asistente</span>
        </div>
        <div className="flex items-center gap-2">
          {usage && (
            <span
              className={cn(
                "text-xs text-muted-foreground",
                exhausted && "font-medium text-destructive",
              )}
              title="Generaciones de IA usadas hoy"
            >
              {usage.usedToday}/{usage.dailyLimit}
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Cerrar asistente"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        <AnimatedAssistant text={welcomeText} scrollToBottom={scrollToBottom} />

        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "flex flex-col gap-1.5",
              entry.role === "user" ? "items-end" : "items-start",
            )}
          >
            {entry.role === "user" ? (
              <Bubble role="user" text={entry.text} />
            ) : entry.id === lastAssistantId ? (
              <AnimatedAssistant
                text={entry.text}
                actions={entry.actions}
                scrollToBottom={scrollToBottom}
                onRun={(action, index) =>
                  handleExecute(entry.id, action, index)
                }
              />
            ) : (
              <AnimatedAssistant
                text={entry.text}
                actions={entry.actions}
                instant
                scrollToBottom={scrollToBottom}
                onRun={(action, index) =>
                  handleExecute(entry.id, action, index)
                }
              />
            )}
          </div>
        ))}

        {sending && (
          <div className="flex animate-msg-in justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
              <span className="flex items-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-typing-dot"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-2 border-t p-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            markActivity();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            exhausted ? "Límite diario alcanzado" : "Escribile al asistente…"
          }
          maxLength={2000}
          className="h-9"
        />
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Enviar"
          disabled={sending || !text.trim() || exhausted}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AnimatedAssistant({
  text,
  actions,
  instant = false,
  scrollToBottom,
  onRun,
}: {
  text: string;
  actions?: AssistantActionItem[];
  instant?: boolean;
  scrollToBottom: () => void;
  onRun?: (action: AssistantActionItem["action"], index: number) => void;
}) {
  const { visible, done } = useTypewriter(text, {
    enabled: !instant,
    onTick: scrollToBottom,
  });

  useEffect(() => {
    if (done) scrollToBottom();
  }, [done, scrollToBottom]);

  return (
    <>
      <Bubble
        role="assistant"
        text={instant ? text : visible}
        typing={!instant && !done}
      />
      {done &&
        actions?.map((item, index) => (
          <ActionChip
            key={`${index}`}
            item={item}
            onRun={() => onRun?.(item.action, index)}
          />
        ))}
    </>
  );
}

function Bubble({
  role,
  text,
  typing = false,
}: {
  role: "user" | "assistant";
  text: string;
  typing?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap animate-msg-in",
        role === "user"
          ? "rounded-br-sm bg-primary text-primary-foreground"
          : "rounded-bl-sm bg-muted text-muted-foreground",
      )}
    >
      {text}
      {typing && (
        <span className="ml-0.5 inline-block animate-caret-blink">▎</span>
      )}
    </div>
  );
}

function ActionChip({
  item,
  onRun,
}: {
  item: AssistantActionItem;
  onRun: () => void;
}) {
  const { action, status } = item;
  const done = status === "done";
  const running = status === "running";

  if (action.kind === "complete") {
    return (
      <Button
        type="button"
        variant={done ? "secondary" : "outline"}
        size="sm"
        className={cn(
          "h-7 px-2 text-xs",
          "rounded-full animate-fade-up",
          done && "cursor-default",
        )}
        disabled={!done && running}
        onClick={() => {
          if (!done && !running) onRun();
        }}
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {done
          ? "Completada"
          : running
            ? "Completando…"
            : `Marcar "${action.taskTitle}" como hecha`}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={done ? "secondary" : "outline"}
      size="sm"
      className={cn(
        "h-7 px-2 text-xs",
        "rounded-full animate-fade-up",
        done && "cursor-default",
      )}
      disabled={!done && running}
      onClick={() => {
        if (!done && !running) onRun();
      }}
    >
      {done ? (
        <BellRing className="h-3.5 w-3.5" />
      ) : running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <BellRing className="h-3.5 w-3.5" />
      )}
      {done
        ? "Recordatorio creado"
        : running
          ? "Creando recordatorio…"
          : `Recordarme: ${action.title}`}
    </Button>
  );
}
