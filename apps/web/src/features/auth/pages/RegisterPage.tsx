import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema } from "@taskmaster/contracts";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/http";
import { register, resendVerification } from "../api/auth.api";

type FormValues = { name: string; email: string; password: string };

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      await register(values);
      setRegisteredEmail(values.email);
      setRegistered(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendState("sending");
    try {
      await resendVerification(registeredEmail);
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  if (registered) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Revisa tu email</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace para activar tu cuenta. También podés entrar ya
          mismo, pero te pediremos verificar tu email.
        </p>
        {resendState === "sent" ? (
          <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MailCheck className="h-4 w-4" /> Enviamos un nuevo enlace.
          </p>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={resendState === "sending"}
          >
            {resendState === "sending"
              ? "Enviando…"
              : resendState === "error"
                ? "Hubo un error, reintentar"
                : "Reenviar enlace"}
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate("/login")}
        >
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" autoComplete="name" {...registerField("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...registerField("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...registerField("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          to="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
