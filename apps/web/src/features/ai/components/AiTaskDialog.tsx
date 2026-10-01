import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { NlTaskDraft } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiNlTask } from "../hooks/useAiNlTask";
import { useAiUsage } from "../hooks/useAiUsage";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

export function AiTaskDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (draft: NlTaskDraft) => void;
}) {
  const [text, setText] = useState("");
  const mutation = useAiNlTask();
  const { data: usage } = useAiUsage();
  const qc = useQueryClient();
  const workspaceId = useCurrentWorkspaceId();

  const exhausted = usage ? usage.usedToday >= usage.dailyLimit : false;

  function handleGenerate() {
    if (!text.trim()) return;
    mutation.mutate(text.trim(), {
      onSuccess: (draft) => {
        void qc.invalidateQueries({ queryKey: ["ai-usage", workspaceId] });
        setText("");
        onGenerated(draft);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crear tarea con IA"
      description="Escribí la tarea en lenguaje natural y la IA prepara un borrador que podés revisar antes de guardar."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej.: Preparar la presentación para el cliente del viernes, prioridad alta, con fecha límite el jueves…"
            rows={6}
            maxLength={2000}
          />
          <p className="text-right text-xs text-muted-foreground">
            {text.length}/2000
          </p>
        </div>

        {usage && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Generaciones de hoy</span>
              <span className={exhausted ? "font-medium text-destructive" : ""}>
                {usage.usedToday}/{usage.dailyLimit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  exhausted ? "bg-destructive" : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (usage.usedToday / usage.dailyLimit) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {(mutation.error as Error)?.message ??
              "No pudimos generar la tarea. Intentalo de nuevo."}
          </p>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={handleGenerate}
          disabled={!text.trim() || mutation.isPending || exhausted}
        >
          <Sparkles className="h-4 w-4" />
          {mutation.isPending
            ? "Generando…"
            : exhausted
              ? "Cuota diaria agotada"
              : "Generar borrador"}
        </Button>
      </div>
    </Dialog>
  );
}
