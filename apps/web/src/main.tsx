import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/app/error-boundary";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";
import { applyTheme } from "@/store/ui.store";
import "@/styles/globals.css";

applyTheme(useUiStore.getState().theme);

localStorage.removeItem("taskmaster.accessToken");
localStorage.removeItem("taskmaster.refreshToken");

useAuthStore.persist.rehydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
