import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";
import type { DreamPinDto } from "@taskmaster/contracts";
import { useTasks } from "@/features/tasks/hooks/useTasks";

const STICKERS = ["🎯", "🚀", "🔥", "⭐", "💡", "✅"];

interface PinDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pin: DreamPinDto | null;
  onUpdate: (data: {
    title: string;
    description?: string;
    imageUrl?: string | null;
    sticker?: string | null;
    linkedTaskId?: string | null;
  }) => void;
  onDelete: () => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
}

export function PinDetailModal({
  open,
  onOpenChange,
  pin,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: PinDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(pin?.title ?? "");
  const [description, setDescription] = useState(pin?.description ?? "");
  const [imageUrl, setImageUrl] = useState(pin?.imageUrl ?? "");
  const [sticker, setSticker] = useState(pin?.sticker ?? "");
  const [linkedTaskId, setLinkedTaskId] = useState(pin?.linkedTaskId ?? "");
  const { data: tasksData } = useTasks({ pageSize: 500 });

  useEffect(() => {
    if (pin) {
      setTitle(pin.title);
      setDescription(pin.description);
      setImageUrl(pin.imageUrl ?? "");
      setSticker(pin.sticker ?? "");
      setLinkedTaskId(pin.linkedTaskId ?? "");
    }
  }, [pin]);

  if (!pin) return null;

  const handleSave = () => {
    onUpdate({
      title,
      description: description || undefined,
      imageUrl: imageUrl,
      sticker: sticker || null,
      linkedTaskId: linkedTaskId || null,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirm("¿Eliminar este pin?")) {
      onDelete();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Editar pin" : pin.title}
      className="max-w-md"
    >
      <div className="space-y-4">
        {!editing ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Descripción</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {pin.description || "Sin descripción"}
              </p>
            </div>
            {pin.imageUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Imagen</p>
                <img
                  src={pin.imageUrl}
                  alt="Imagen del pin"
                  className="max-h-64 w-full rounded-md object-contain border"
                />
              </div>
            )}
            {pin.linkedTask && (
              <div className="rounded-md bg-muted p-2 text-sm">
                <p className="font-medium">Tarea vinculada</p>
                <p className="text-muted-foreground">{pin.linkedTask.title}</p>
                <p className="text-xs text-muted-foreground">
                  Estado: {pin.linkedTask.status}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Tipo</p>
                <p className="text-muted-foreground">{pin.type}</p>
              </div>
              <div>
                <p className="font-medium">Color</p>
                <p className="text-muted-foreground">{pin.color}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                Eliminar
              </Button>
              <Button
                onClick={() => {
                  setTitle(pin.title);
                  setDescription(pin.description);
                  setImageUrl(pin.imageUrl ?? "");
                  setSticker(pin.sticker ?? "");
                  setLinkedTaskId(pin.linkedTaskId ?? "");
                  setEditing(true);
                }}
              >
                Editar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="pin-detail-title">Título</Label>
              <Input
                id="pin-detail-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-detail-description">Descripción</Label>
              <Textarea
                id="pin-detail-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-url-input">Imagen</Label>
              <ImageUploader value={imageUrl} onChange={setImageUrl} />
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
                    variant={sticker === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSticker(s)}
                  >
                    {s}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSticker("")}
                >
                  Quitar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-detail-task">Vincular a tarea</Label>
              <select
                id="pin-detail-task"
                value={linkedTaskId}
                onChange={(e) => setLinkedTaskId(e.target.value)}
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
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                Guardar
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
