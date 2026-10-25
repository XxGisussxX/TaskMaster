import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { hasMarkup, sanitizeHtml } from "@/lib/sanitize-html";

export function RichText({
  html,
  className,
}: {
  html?: string | null;
  className?: string;
}) {
  const value = html ?? "";
  const markup = hasMarkup(value);
  const safe = useMemo(
    () => (markup ? sanitizeHtml(value) : ""),
    [value, markup],
  );

  if (!value) return null;

  if (!markup) {
    return <p className={cn("whitespace-pre-wrap", className)}>{value}</p>;
  }

  return (
    <div
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
