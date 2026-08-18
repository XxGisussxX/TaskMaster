import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateTimeEntry, useStopTimeEntry } from "./useTimeEntries";

const STORAGE_KEY = "taskmaster.activeTimer";

interface ActiveTimerState {
  entryId: string;
  taskId: string;
  startedAt: number;
}

function loadTimerState(): ActiveTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveTimerState;
  } catch {
    return null;
  }
}

function saveTimerState(state: ActiveTimerState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useActiveTimer() {
  const createEntry = useCreateTimeEntry();
  const stopEntry = useStopTimeEntry();

  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const clearTimerInterval = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimerInterval = useCallback(
    (startEpoch: number) => {
      clearTimerInterval();
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startEpoch) / 1000);
        setSeconds(elapsed);
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    },
    [clearTimerInterval],
  );

  useEffect(() => {
    const saved = loadTimerState();
    if (saved) {
      setIsRunning(true);
      setEntryId(saved.entryId);
      setActiveTaskId(saved.taskId);
      startedAtRef.current = saved.startedAt;
      startTimerInterval(saved.startedAt);
    }

    return () => clearTimerInterval();
  }, [startTimerInterval, clearTimerInterval]);

  const startTimer = useCallback(
    async (taskId: string, description?: string) => {
      const now = new Date();
      const startedAt = now.toISOString();

      const result = await createEntry.mutateAsync({
        taskId,
        description: description ?? "",
        startedAt,
      });

      const state: ActiveTimerState = {
        entryId: result.id,
        taskId,
        startedAt: now.getTime(),
      };
      saveTimerState(state);

      setIsRunning(true);
      setEntryId(result.id);
      setActiveTaskId(taskId);
      startedAtRef.current = now.getTime();
      startTimerInterval(now.getTime());
    },
    [createEntry, startTimerInterval],
  );

  const stopTimer = useCallback(async () => {
    if (!entryId) return;

    await stopEntry.mutateAsync(entryId);

    clearTimerInterval();
    saveTimerState(null);
    setIsRunning(false);
    setSeconds(0);
    setEntryId(null);
    setActiveTaskId(null);
  }, [entryId, stopEntry, clearTimerInterval]);

  return {
    isRunning,
    seconds,
    entryId,
    activeTaskId,
    startTimer,
    stopTimer,
    isStarting: createEntry.isPending,
    isStopping: stopEntry.isPending,
  };
}
