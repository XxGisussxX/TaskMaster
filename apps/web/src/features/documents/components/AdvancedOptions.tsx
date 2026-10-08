import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { FontSizeOption, MarginOption } from "@taskmaster/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DocumentOptions {
  fontSize: FontSizeOption;
  margin: MarginOption;
  accentColor: string;
}

interface AdvancedOptionsProps {
  value: DocumentOptions;
  onChange: (value: DocumentOptions) => void;
  showAccentColor: boolean;
}

const FONT_SIZE_LABELS: Record<FontSizeOption, string> = {
  sm: "Pequeño",
  md: "Mediano",
  lg: "Grande",
};

const MARGIN_LABELS: Record<MarginOption, string> = {
  narrow: "Estrecho",
  normal: "Normal",
  wide: "Amplio",
};

export function AdvancedOptions({
  value,
  onChange,
  showAccentColor,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="h-11 w-full justify-between rounded-lg px-3"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Opciones avanzadas
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>

      {open ? (
        <div className="grid grid-cols-1 gap-4 border-t border-border/70 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-font-size">Tamaño de fuente</Label>
            <Select
              id="doc-font-size"
              value={value.fontSize}
              onChange={(event) =>
                onChange({
                  ...value,
                  fontSize: event.target.value as FontSizeOption,
                })
              }
            >
              {(Object.keys(FONT_SIZE_LABELS) as FontSizeOption[]).map(
                (option) => (
                  <option key={option} value={option}>
                    {FONT_SIZE_LABELS[option]}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-margin">Margen</Label>
            <Select
              id="doc-margin"
              value={value.margin}
              onChange={(event) =>
                onChange({
                  ...value,
                  margin: event.target.value as MarginOption,
                })
              }
            >
              {(Object.keys(MARGIN_LABELS) as MarginOption[]).map((option) => (
                <option key={option} value={option}>
                  {MARGIN_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>

          {showAccentColor ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-accent">Color de acento</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="doc-accent"
                  type="color"
                  value={value.accentColor}
                  onChange={(event) =>
                    onChange({ ...value, accentColor: event.target.value })
                  }
                  className="h-9 w-14 cursor-pointer p-1"
                />
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  {value.accentColor}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
