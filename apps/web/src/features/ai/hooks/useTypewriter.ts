import { useEffect, useRef, useState } from "react";

export interface UseTypewriterOptions {
  enabled?: boolean;
  startDelayMs?: number;
  stepMs?: number;
  onTick?: () => void;
}

export function useTypewriter(
  text: string,
  {
    enabled = true,
    startDelayMs = 350,
    stepMs = 18,
    onTick,
  }: UseTypewriterOptions = {},
): { visible: string; done: boolean } {
  const [state, setState] = useState({ count: 0, started: false });
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) {
      setState({ count: text.length, started: true });
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setState((prev) => {
          if (prev.count >= text.length) {
            if (interval) clearInterval(interval);
            return { ...prev, started: true };
          }
          onTickRef.current?.();
          return { ...prev, count: prev.count + 1 };
        });
      }, stepMs);
    }, startDelayMs);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, enabled, stepMs, startDelayMs]);

  const done = state.started && state.count >= text.length;
  return { visible: text.slice(0, state.count), done };
}
