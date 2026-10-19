import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";
import {
  createDreamPinSchema,
  DreamPinType,
  DreamPinColor,
} from "@taskmaster/contracts";
import type { z } from "zod";
import { useTasks } from "@/features/tasks/hooks/useTasks";

const typeOptions = Object.values(DreamPinType) as [string, ...string[]];
const colorOptions = Object.values(DreamPinColor) as [string, ...string[]];
const STICKERS = ["🎯", "🚀", "🔥", "⭐", "💡", "✅"];

interface AddPinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: z.infer<typeof createDreamPinSchema>) => void;
  isLoading?: boolean;
}

export function AddPinModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AddPinModalProps) {
  const [form, setForm] = useState({
    title: "",
    type: "GOAL" as const,
    color: "AMBER" as const,
    description: "",
    imageUrl: "",
    sticker: "",
    linkedTaskId: "",
  });
  const { data: tasksData } = useTasks({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createDreamPinSchema.safeParse({
      title: form.title,
      type: form.type,
      color: form.color,
      description: form.description,
      imageUrl: form.imageUrl || undefined,
      sticker: form.sticker || undefined,
      linkedTaskId: form.linkedTaskId || undefined,
      positionX: Math.floor(Math.random() * 600) + 100,
      positionY: Math.floor(Math.random() * 400) + 100,
    });
    if (parsed.success) {
      onSubmit(parsed.data);
      setForm({
        title: "",
        type: "GOAL",
        color: "AMBER",
        description: "",
        imageUrl: "",
        sticker: "",
        linkedTaskId: "",
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar Sueño"
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pin-title">Título</Label>
          <Input
            id="pin-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Mi meta..."
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pin-type">Tipo</Label>
            <select
              id="pin-type"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as typeof form.type })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin-color">Color</Label>
            <select
              id="pin-color"
              value={form.color}
              onChange={(e) =>
                setForm({ ...form, color: e.target.value as typeof form.color })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              {colorOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin-description">Descripción</Label>
          <Textarea
            id="pin-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descripción opcional..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="image-url-input">Imagen</Label>
          <ImageUploader
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Sticker</span>
          <div
            role="group"
            aria-label="Sticker"
            className="flex flex-wrap gap-2"
          >
            {STICKERS.map((s) => (
              <Button
                key={s}
                type="button"
                variant={form.sticker === s ? "default" : "outline"}
                size="sm"
                onClick={() => setForm({ ...form, sticker: s })}
              >
                {s}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm({ ...form, sticker: "" })}
            >
              Quitar
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin-task">Vincular a tarea</Label>
          <select
            id="pin-task"
            value={form.linkedTaskId}
            onChange={(e) => setForm({ ...form, linkedTaskId: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">Sin tarea</option>
            {(tasksData?.items ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            Crear
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
