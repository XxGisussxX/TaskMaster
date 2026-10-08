import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, UIEvent } from "react";
import { classifyLine } from "@taskmaster/templates";
import { cn } from "@/lib/utils";
import { lineNumbers, PLACEHOLDER, styleForLine } from "../lib/highlight";

const EDITOR_TEXT_CLASS =
  "font-mono text-[13px] leading-6 whitespace-pre-wrap break-words";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  className,
  ariaLabel = "Contenido del documento",
}: MarkdownEditorProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = useMemo(() => value.split("\n"), [value]);

  const highlighted = useMemo(
    () =>
      lines.map((line, index) => (
        <span
          key={index}
          className={cn(
            EDITOR_TEXT_CLASS,
            "block",
            styleForLine(classifyLine(line), line),
          )}
        >
          {line.length > 0 ? line : " "}
        </span>
      )),
    [lines],
  );

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="shrink-0 select-none border-r border-border/70 bg-muted/40 px-3 py-3 text-right"
      >
        <div
          className="font-mono text-[13px] leading-6"
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {lineNumbers(lines.length).map((number) => (
            <div key={number} className="text-muted-foreground/70">
              {number}
            </div>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-3"
        >
          <div style={{ transform: `translateY(-${scrollTop}px)` }}>
            {highlighted}
          </div>
        </pre>

        <textarea
          ref={textRef}
          value={value}
          onChange={handleChange}
          onScroll={handleScroll}
          aria-label={ariaLabel}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className={cn(
            EDITOR_TEXT_CLASS,
            "relative block h-full w-full resize-none overflow-y-auto bg-transparent px-3 py-3 text-transparent caret-foreground outline-none placeholder:text-muted-foreground/50",
          )}
        />
      </div>
    </div>
  );
}
