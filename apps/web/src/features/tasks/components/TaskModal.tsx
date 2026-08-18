import { useState } from "react";
import type { Task } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { TaskForm, type TaskFormValues } from "./TaskForm";
import { CommentSection } from "./CommentSection";
import { FileUpload } from "@/features/attachments/components/FileUpload";
import { UseTemplateButton } from "@/features/task-templates/components/UseTemplateButton";
import { SaveAsTemplateButton } from "@/features/task-templates/components/SaveAsTemplateButton";
import { TimeEntryList } from "@/features/time-entries/components/TimeEntryList";
import { TimeEntryForm } from "@/features/time-entries/components/TimeEntryForm";
import { CustomFieldForm } from "@/features/custom-fields/components/CustomFieldForm";
import { AddDependencyButton } from "@/features/task-dependencies/components/AddDependencyButton";
import { DependencyList } from "@/features/task-dependencies/components/DependencyList";
import { useTaskDependencies } from "@/features/task-dependencies/hooks/useTaskDependencies";
import { useTasks } from "../hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Link2, Clock, MessageSquare, SlidersHorizontal } from "lucide-react";

type DetailTab = "comments" | "dependencies" | "time" | "fields";

export function TaskModal({
  open,
  onOpenChange,
  task,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  submitting?: boolean;
}) {
  const [templateData, setTemplateData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("comments");
  const { data: deps } = useTaskDependencies(task?.id ?? null);
  const { data: allTasks } = useTasks({ pageSize: 100 });
  const taskList = allTasks?.items ?? [];

  const tabs: {
    value: DetailTab;
    label: string;
    icon: typeof MessageSquare;
  }[] = [
    { value: "comments", label: "Comentarios", icon: MessageSquare },
    { value: "dependencies", label: "Dependencias", icon: Link2 },
    { value: "time", label: "Tiempo", icon: Clock },
    { value: "fields", label: "Campos", icon: SlidersHorizontal },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Editar tarea" : "Nueva tarea"}
      description={
        task
          ? "Actualiza los detalles de la tarea"
          : "Crea una tarea y asígnala a tu equipo"
      }
      className={task ? "max-w-2xl" : undefined}
    >
      {!task && (
        <div className="mb-3">
          <UseTemplateButton onSelect={(data) => setTemplateData(data)} />
        </div>
      )}

      <TaskForm
        task={task}
        templateData={templateData}
        onSubmit={async (values) => {
          await onSubmit(values);
          setTemplateData(null);
          onOpenChange(false);
        }}
        submitting={submitting}
      />

      {task && (
        <>
          <hr className="my-5 border-border" />

          <div className="mb-4 flex gap-1">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? "default" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={() => setActiveTab(tab.value)}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            ))}
          </div>

          {activeTab === "comments" && (
            <div className="space-y-4">
              <CommentSection taskId={task.id} />
              <hr className="my-4 border-border" />
              <h4 className="mb-3 text-sm font-medium">Archivos adjuntos</h4>
              <FileUpload taskId={task.id} />
            </div>
          )}

          {activeTab === "dependencies" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Dependencias</h4>
                <AddDependencyButton
                  taskId={task.id}
                  tasks={taskList}
                  direction="from"
                />
              </div>
              <DependencyList
                taskId={task.id}
                dependencies={deps}
                tasks={taskList}
              />
            </div>
          )}

          {activeTab === "time" && (
            <div className="space-y-4">
              <TimeEntryList taskId={task.id} />
              <TimeEntryForm taskId={task.id} />
            </div>
          )}

          {activeTab === "fields" && (
            <CustomFieldForm entityType="task" entityId={task.id} />
          )}

          <div className="mt-4 flex justify-end">
            <SaveAsTemplateButton
              data={{
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                startDate: task.startDate,
                categoryId: task.categoryId,
                tagIds: task.tags?.map((t) => t.id) ?? [],
                assigneeIds: task.assignees?.map((a) => a.id) ?? [],
              }}
            />
          </div>
        </>
      )}
    </Dialog>
  );
}
