import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskTemplates } from "../hooks/useTaskTemplates";

interface UseTemplateButtonProps {
  onSelect: (data: Record<string, unknown>) => void;
}

export function UseTemplateButton({ onSelect }: UseTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: templates } = useTaskTemplates();

  if (!templates || templates.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <FileText className="h-3.5 w-3.5" />
        Usar plantilla
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
            {templates.map((template) => (
              <button
                key={template.id}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                onClick={() => {
                  onSelect(template.data);
                  setOpen(false);
                }}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{template.name}</p>
                  {template.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
