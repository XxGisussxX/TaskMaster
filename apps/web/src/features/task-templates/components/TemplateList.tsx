import { Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useTaskTemplates,
  useDeleteTaskTemplate,
} from "../hooks/useTaskTemplates";

interface TemplateListProps {
  onSelect: (data: Record<string, unknown>) => void;
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const { data: templates } = useTaskTemplates();
  const deleteTemplate = useDeleteTaskTemplate();

  if (!templates || templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay plantillas guardadas
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
        >
          <button
            className="flex flex-1 items-center gap-3 text-left"
            onClick={() => onSelect(template.data)}
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{template.name}</p>
              {template.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {template.description}
                </p>
              )}
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (
                window.confirm(`¿Eliminar la plantilla "${template.name}"?`)
              ) {
                deleteTemplate.mutate(template.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
