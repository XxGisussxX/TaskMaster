import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/http";
import { resetPassword } from "../api/auth.api";

const resetFormSchema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(128),
    confirm: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof resetFormSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, values.password);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Enlace incompleto</h2>
        <p className="text-sm text-muted-foreground">
          Este enlace de restablecimiento es inválido. Solicitalo nuevamente.
        </p>
        <Link
          to="/forgot-password"
          className="block text-primary underline-offset-4 hover:underline"
        >
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Contraseña actualizada</h2>
        <p className="text-sm text-muted-foreground">
          Ya podés iniciar sesión con tu nueva contraseña. Cerramos tus demás
          sesiones por seguridad.
        </p>
        <Button className="w-full" onClick={() => navigate("/login")}>
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Nueva contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Elegí una contraseña segura y confirmala.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="text-sm text-destructive">{errors.confirm.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
