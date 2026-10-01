import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema } from "@taskmaster/contracts";
import { useNavigate } from "react-router-dom";
import { KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/http";
import { forgotPassword } from "../api/auth.api";

type FormValues = { email: string };

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(values.email);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <MailCheck className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Revisá tu email</h2>
        <p className="text-sm text-muted-foreground">
          Si existe una cuenta con ese email, te enviamos un enlace para
          restablecer tu contraseña.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/login")}
        >
          Volver a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Restablecer contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Ingresá tu email y te enviamos un enlace para crear una nueva.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          <span className="inline-flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> Volver a iniciar sesión
          </span>
        </Link>
      </p>
    </form>
  );
}
