import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string | null;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar…",
  onCreateNew,
  createLabel = "Crear",
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  onCreateNew?: (name: string) => void;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const showCreate =
    onCreateNew &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
    setQuery("");
  }

  function handleCreate() {
    const name = query.trim();
    if (name && onCreateNew) {
      onCreateNew(name);
      setQuery("");
    }
  }

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex min-h-[36px] flex-wrap gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm cursor-pointer",
          open && "ring-2 ring-ring",
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedOptions.map((o) => (
          <span
            key={o.value}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
          >
            {o.color && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: o.color }}
              />
            )}
            {o.label}
            <button
              type="button"
              className="ml-0.5 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                toggle(o.value);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selectedOptions.length === 0 && !open && (
          <span className="py-0.5 text-muted-foreground">{placeholder}</span>
        )}
        {open && (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[80px] flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
          />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.length === 0 && !showCreate && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Sin resultados
            </p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                selected.includes(o.value) && "bg-accent",
              )}
              onClick={() => toggle(o.value)}
            >
              {o.color && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
              )}
              <span className="flex-1 text-left">{o.label}</span>
              {selected.includes(o.value) && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
              onClick={handleCreate}
            >
              {createLabel}: "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
