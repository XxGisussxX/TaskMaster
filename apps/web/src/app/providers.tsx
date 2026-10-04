import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";
import { useSessionBootstrap } from "@/hooks/useSessionBootstrap";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useSessionBootstrap();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
