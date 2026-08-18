import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveTimer } from "../hooks/useActiveTimer";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TimerButtonProps {
  taskId: string;
  taskTitle?: string;
}

export function TimerButton({ taskId, taskTitle }: TimerButtonProps) {
  const {
    isRunning,
    seconds,
    activeTaskId,
    startTimer,
    stopTimer,
    isStarting,
    isStopping,
  } = useActiveTimer();

  const isActiveForThisTask = isRunning && activeTaskId === taskId;

  async function handleClick() {
    if (isActiveForThisTask) {
      await stopTimer();
    } else if (!isRunning) {
      await startTimer(taskId);
    }
  }

  if (isActiveForThisTask) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
        onClick={handleClick}
        disabled={isStopping}
        title={`Detener temporizador para: ${taskTitle ?? taskId}`}
      >
        <Square className="h-3 w-3 fill-current" />
        <span className="font-mono tabular-nums">
          {formatDuration(seconds)}
        </span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={handleClick}
      disabled={isRunning || isStarting}
      title={`Iniciar temporizador para: ${taskTitle ?? taskId}`}
    >
      <Play className="h-3 w-3" />
    </Button>
  );
}
