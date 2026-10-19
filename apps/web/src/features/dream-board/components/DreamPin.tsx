import {
  Target,
  Rocket,
  BookOpen,
  Plane,
  DollarSign,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DreamPinDto } from "@taskmaster/contracts";

const colorMap: Record<string, string> = {
  AMBER: "bg-amber-500 text-white",
  ROSE: "bg-rose-500 text-white",
  SKY: "bg-sky-500 text-white",
  EMERALD: "bg-emerald-500 text-white",
  VIOLET: "bg-violet-500 text-white",
  SLATE: "bg-slate-500 text-white",
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GOAL: Target,
  PROJECT: Rocket,
  LEARNING: BookOpen,
  TRAVEL: Plane,
  FINANCIAL: DollarSign,
  HEALTH: Heart,
};

const statusColorMap: Record<string, string> = {
  TODO: "bg-gray-500",
  IN_PROGRESS: "bg-yellow-500",
  IN_REVIEW: "bg-blue-500",
  DONE: "bg-green-500",
  ARCHIVED: "bg-slate-500",
};

interface DreamPinProps {
  pin: DreamPinDto;
  onOpen: () => void;
}

export function DreamPin({ pin, onOpen }: DreamPinProps) {
  const Icon = iconMap[pin.type] || Target;

  if (pin.imageUrl) {
    return (
      <button
        type="button"
        aria-label={`Abrir pin ${pin.title}`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }
        }}
        className="relative flex flex-col items-center rounded-lg bg-white p-1 shadow-md transition-transform hover:scale-105"
        style={{ userSelect: "none" }}
      >
        <img
          src={pin.imageUrl}
          alt={pin.title}
          className="h-32 w-32 rounded object-cover"
        />
        {pin.sticker && (
          <span className="absolute right-1 top-1 text-lg">{pin.sticker}</span>
        )}
        <span className="mt-1 max-w-[120px] truncate text-xs font-medium">
          {pin.title}
        </span>
        {pin.linkedTask && (
          <div className="mt-1 flex w-full items-center gap-1 px-1">
            <div
              className={cn(
                "h-1.5 w-full rounded",
                statusColorMap[pin.linkedTask.status] || "bg-gray-500",
              )}
            />
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Abrir pin ${pin.title}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-full px-3 py-2 shadow-md ring-2 ring-white/80 transition-transform hover:scale-105",
        colorMap[pin.color],
      )}
      style={{ userSelect: "none" }}
    >
      {pin.sticker && (
        <span className="absolute -right-1 -top-1 text-lg">{pin.sticker}</span>
      )}
      <Icon className="h-4 w-4" />
      <span className="max-w-[120px] truncate text-xs font-medium">
        {pin.title}
      </span>
      {pin.linkedTask && (
        <div className="absolute -bottom-1 flex w-full items-center justify-center">
          <div
            className={cn(
              "h-1.5 w-10 rounded",
              statusColorMap[pin.linkedTask.status] || "bg-gray-500",
            )}
          />
        </div>
      )}
    </button>
  );
}
