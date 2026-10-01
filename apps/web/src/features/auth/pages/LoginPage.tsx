import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { loginSchema } from "@taskmaster/contracts";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/http";
import { useAuthStore } from "@/store/auth.store";
import { login, resendVerification } from "../api/auth.api";

type FormValues = { email: string; password: string };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      await login(values);
      const user = useAuthStore.getState().user;
      if (user && !user.isEmailVerified) {
        setUnverified(true);
        setUnverifiedEmail(user.email);
        return;
      }
      const from = (location.state as { from?: { pathname: string } } | null)
        ?.from?.pathname;
      navigate(from ?? "/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState("sending");
    try {
      await resendVerification(unverifiedEmail);
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            to="/forgot-password"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {unverified && (
        <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-sm text-muted-foreground">
            Tu email todavía no está verificado. Revisá tu correo o reenviá el
            enlace de confirmación.
          </p>
          {resendState === "sent" ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MailCheck className="h-4 w-4" /> Enviamos un nuevo enlace.
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resendState === "sending"}
            >
              {resendState === "sending"
                ? "Enviando…"
                : resendState === "error"
                  ? "Reintentar reenvío"
                  : "Reenviar enlace"}
            </Button>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando…" : "Iniciar sesión"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          to="/register"
          className="text-primary underline-offset-4 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </form>
  );
}
