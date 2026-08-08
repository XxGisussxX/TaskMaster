import { Loader2 } from "lucide-react";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin ${className ?? ""}`} />;
}

export function PageLoader() {
  return (
    <div className="flex h-48 items-center justify-center text-muted-foreground">
      <Spinner />
    </div>
  );
}
