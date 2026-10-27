import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

function colorHash(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 60% 45%)`;
}

export function Avatar({ name, src, className }: AvatarProps) {
  // Una URL rota (foto externa vencida, borrada o con el host caído) no debe
  // dejar el hueco de una imagen rota: se cae a las iniciales, igual que una
  // cuenta sin avatar. Se guarda la URL que falló para reintentar si cambia.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => setFailedSrc(null), [src]);

  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const showImage = Boolean(src) && failedSrc !== src;
  const imageSrc = showImage ? src : null;

  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className,
      )}
      style={showImage ? undefined : { backgroundColor: colorHash(name) }}
      aria-label={name}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
