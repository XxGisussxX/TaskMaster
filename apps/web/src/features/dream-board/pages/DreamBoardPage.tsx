import { useState } from "react";
import { Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import {
  useDreamBoard,
  useCreateDreamPin,
  useUpdateDreamPin,
  useDeleteDreamPin,
} from "../hooks/useDreamBoard";
import { DreamPin } from "../components/DreamPin";
import { AddPinModal } from "../components/AddPinModal";
import { PinDetailModal } from "../components/PinDetailModal";
import type { DreamPinDto } from "@taskmaster/contracts";

export function DreamBoardPage() {
  const { data: board, isLoading } = useDreamBoard();
  const createPin = useCreateDreamPin();
  const updatePin = useUpdateDreamPin();
  const deletePin = useDeleteDreamPin();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<DreamPinDto | null>(null);

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
      {board?.pins?.map((pin: DreamPinDto) => (
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
