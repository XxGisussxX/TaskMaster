import { useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { useRef } from "react";
import {
  useDreamBoard,
  useCreateDreamPin,
  useUpdateDreamPin,
  useDeleteDreamPin,
  useUpdateDreamBoard,
} from "../hooks/useDreamBoard";
import { DreamPin } from "../components/DreamPin";
import { AddPinModal } from "../components/AddPinModal";
import { PinDetailModal } from "../components/PinDetailModal";
import type { DreamPinDto } from "@taskmaster/contracts";

export function DreamBoardPage() {
  const { data: board, isLoading, isError, refetch } = useDreamBoard();
  const createPin = useCreateDreamPin();
  const updatePin = useUpdateDreamPin();
  const deletePin = useDeleteDreamPin();
  const renameBoard = useUpdateDreamBoard();
  const lastUpdateRef = useRef<{ pinId: string; x: number; y: number } | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<DreamPinDto | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const startEditingTitle = () => {
    setTitleDraft(board?.title ?? "Mi Tablero de Sueños");
    setEditingTitle(true);
  };

  const saveTitle = () => {
    const title = titleDraft.trim();
    setEditingTitle(false);
    if (title && title !== board?.title) renameBoard.mutate(title);
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#d4a373",
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute top-4 left-4 z-10">
        {editingTitle ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={titleDraft}
              maxLength={120}
              aria-label="Título del tablero"
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="h-8 w-56 bg-white/95"
            />
            <Button
              size="icon"
              className="h-8 w-8"
              aria-label="Guardar título"
              onClick={saveTitle}
              disabled={renameBoard.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditingTitle}
            aria-label="Renombrar tablero"
            className="group flex items-center gap-2 text-lg font-semibold text-white drop-shadow-md"
          >
            {board?.title ?? "Mi Tablero de Sueños"}
            <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>
      <div className="absolute top-4 right-4 z-10">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Sueño
        </Button>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          Cargando...
        </div>
      )}
      {isError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-card p-2 shadow-md">
            <ErrorState
              title="No se pudo cargar el tablero"
              onRetry={() => void refetch()}
            />
          </div>
        </div>
      )}
      {!isError &&
        board?.pins?.map((pin: DreamPinDto) => (
          <Rnd
            key={pin.id}
            default={{
              x: pin.x,
              y: pin.y,
              width: "auto",
              height: "auto",
            }}
            bounds="parent"
            enableResizing={false}
            dragHandleClassName="handle"
            onDragStop={(_e, d) => {
              const key = { pinId: pin.id, x: d.x, y: d.y };
              if (
                lastUpdateRef.current &&
                lastUpdateRef.current.pinId === key.pinId &&
                lastUpdateRef.current.x === key.x &&
                lastUpdateRef.current.y === key.y
              ) {
                return;
              }
              lastUpdateRef.current = key;
              updatePin.mutate({
                pinId: pin.id,
                input: { positionX: d.x, positionY: d.y },
              });
            }}
          >
            <div className="handle">
              <DreamPin pin={pin} onOpen={() => setSelectedPin(pin)} />
            </div>
          </Rnd>
        ))}
      <AddPinModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(data) => createPin.mutate(data)}
        isLoading={createPin.isPending}
      />
      <PinDetailModal
        open={!!selectedPin}
        onOpenChange={(open) => !open && setSelectedPin(null)}
        pin={selectedPin}
        onUpdate={(data) =>
          selectedPin &&
          updatePin.mutate({
            pinId: selectedPin.id,
            input: {
              title: data.title,
              description: data.description || "",
              imageUrl: data.imageUrl,
              sticker: data.sticker,
              linkedTaskId: data.linkedTaskId,
            },
          })
        }
        onDelete={() => selectedPin && deletePin.mutate(selectedPin.id)}
        isUpdating={updatePin.isPending}
        isDeleting={deletePin.isPending}
      />
    </div>
  );
}
