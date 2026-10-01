import { useState } from "react";
import { AlertTriangle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { resendVerification } from "../api/auth.api";

/**
 * Aviso global para cuentas con email sin verificar. Permite reenviar el
 * enlace de verificación sin salir de la app.
 */
export function UnverifiedBanner() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (!isHydrated || !user || user.isEmailVerified) return null;

  const handleResend = async () => {
    setState("sending");
    try {
      await resendVerification(user.email);
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <span className="text-muted-foreground">
          No verificaste tu email. Revisá tu correo y confirmá tu cuenta.
        </span>
        {state === "sent" ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MailCheck className="h-4 w-4" /> Enviamos un nuevo enlace.
          </span>
        ) : (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={handleResend}
            disabled={state === "sending"}
          >
            {state === "sending"
              ? "Enviando…"
              : state === "error"
                ? "Hubo un error, reintentar"
                : "Reenviar enlace"}
          </Button>
        )}
      </div>
    </div>
  );
}
