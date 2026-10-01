import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck, MailX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/services/http";
import { useAuthStore } from "@/store/auth.store";
import {
  refreshCurrentUser,
  resendVerification,
  verifyEmail,
} from "../api/auth.api";

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});
type ResendValues = z.infer<typeof resendSchema>;

function Logo() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
        T
      </div>
      <h1 className="text-xl font-semibold">TaskMaster</h1>
    </div>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const isAuthed = useAuthStore((s) => Boolean(s.user));

  const [phase, setPhase] = useState<
    "resend" | "verifying" | "success" | "error"
  >(token ? "verifying" : "resend");
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!token || phase !== "verifying") return;
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setPhase("success");
        if (isAuthed) {
          refreshCurrentUser().catch(() => {
            // Si falla el refresco no bloqueamos la verificación.
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Error de conexión");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthed]);

  const onResend = async (values: ResendValues) => {
    setResendState("sending");
    try {
      await resendVerification(values.email);
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Logo />
        <Card>
          {phase === "verifying" && (
            <CardContent className="flex items-center justify-center py-10">
              <Spinner />
            </CardContent>
          )}

          {phase === "success" && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MailCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Email verificado</CardTitle>
                </div>
                <CardDescription>
                  Tu cuenta quedó activada. Ya podés entrar a TaskMaster.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate(isAuthed ? "/" : "/login", { replace: true })
                  }
                >
                  {isAuthed ? "Continuar a TaskMaster" : "Ir a iniciar sesión"}
                </Button>
              </CardContent>
            </>
          )}

          {phase === "error" && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MailX className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-lg">
                    No pudimos verificar tu email
                  </CardTitle>
                </div>
                <CardDescription>
                  {error ?? "El enlace es inválido o ya no existe."} Reenviá un
                  nuevo enlace a tu correo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resendState === "sent" ? (
                  <p className="text-sm text-muted-foreground">
                    Enviamos un nuevo enlace a tu correo. Revisá tu bandeja de
                    entrada.
                  </p>
                ) : (
                  <form onSubmit={handleSubmit(onResend)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verify-email">Email</Label>
                      <Input
                        id="verify-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        {...register("email")}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">
                          {errors.email.message}
                        </p>
                      )}
                      {resendState === "error" && (
                        <p className="text-sm text-destructive">
                          No pudimos enviar el enlace. Intentá de nuevo.
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={resendState === "sending"}
                    >
                      {resendState === "sending"
                        ? "Enviando…"
                        : "Reenviar enlace"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}

          {phase === "resend" && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    Reenviar verificación
                  </CardTitle>
                </div>
                <CardDescription>
                  Ingresá tu email para recibir un nuevo enlace de verificación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resendState === "sent" ? (
                  <p className="text-sm text-muted-foreground">
                    Enviamos un nuevo enlace a tu correo. Revisá tu bandeja de
                    entrada.
                  </p>
                ) : (
                  <form onSubmit={handleSubmit(onResend)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verify-email">Email</Label>
                      <Input
                        id="verify-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@email.com"
                        {...register("email")}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">
                          {errors.email.message}
                        </p>
                      )}
                      {resendState === "error" && (
                        <p className="text-sm text-destructive">
                          No pudimos enviar el enlace. Intentá de nuevo.
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={resendState === "sending"}
                    >
                      {resendState === "sending"
                        ? "Enviando…"
                        : "Enviar enlace"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>
        {phase === "error" && (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Ir a iniciar sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
