import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loginSchema, registerSchema } from "@taskmaster/contracts";
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
import { useAuthStore } from "@/store/auth.store";
import { ApiError } from "@/services/http";
import { login, logout, register } from "@/features/auth/api/auth.api";
import { useAcceptInvite, useInvitePreview } from "../hooks/useInvite";

type Mode = "login" | "register";

function InviteLogo() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
        T
      </div>
      <h1 className="text-xl font-semibold">TaskMaster</h1>
    </div>
  );
}

function StatusCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md space-y-6">
      <InviteLogo />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </div>
  );
}

function LoginForm({
  email,
  onAuthenticated,
}: {
  email: string;
  onAuthenticated: (email: string, password: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email, password: "" },
  });

  const onSubmit = async (values: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await onAuthenticated(values.email, values.password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          readOnly
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando…" : "Iniciar sesión y unirme"}
      </Button>
    </form>
  );
}

function RegisterForm({
  email,
  onAuthenticated,
}: {
  email: string;
  onAuthenticated: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; email: string; password: string }>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email, password: "" },
  });

  const onSubmit = async (values: {
    name: string;
    email: string;
    password: string;
  }) => {
    setError(null);
    setLoading(true);
    try {
      await onAuthenticated(values.name, values.email, values.password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">Nombre</Label>
        <Input id="register-name" autoComplete="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          readOnly
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Contraseña</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando cuenta…" : "Crear cuenta y unirme"}
      </Button>
    </form>
  );
}

export function AcceptInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [mode, setMode] = useState<Mode>("login");
  const { data: preview, isLoading, error } = useInvitePreview(token);
  const accept = useAcceptInvite();

  const isExpired = preview
    ? new Date(preview.expiresAt).getTime() < Date.now()
    : false;
  const showAccept =
    preview && !preview.accepted && !isExpired && user && isHydrated;

  useEffect(() => {
    if (!showAccept || !accept.isIdle) return;
    accept.mutate(token, {
      onSuccess: () => navigate("/", { replace: true }),
    });
  }, [showAccept, accept, token, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <Spinner />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <StatusCard
          title="Invitación no encontrada"
          description="Este enlace es inválido o ya no existe. Solicitalo nuevamente a quien te invitó."
        >
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Ir a TaskMaster
          </Link>
        </StatusCard>
      </div>
    );
  }

  if (preview.accepted) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <StatusCard
          title="Invitación ya utilizada"
          description={`Ya te uniste al workspace "${preview.workspaceName}".`}
        >
          <Link
            to={user ? "/" : "/login"}
            className="text-primary underline-offset-4 hover:underline"
          >
            Continuar a TaskMaster
          </Link>
        </StatusCard>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <StatusCard
          title="La invitación expiró"
          description="Este enlace ya no es válido. Pedí a quien te invitó que reenvíe una nueva invitación."
        >
          <Link
            to="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            Ir a TaskMaster
          </Link>
        </StatusCard>
      </div>
    );
  }

  if (!user && !isHydrated) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <Spinner />
      </div>
    );
  }

  if (showAccept) {
    if (accept.isError) {
      return (
        <div className="flex min-h-full items-center justify-center bg-background p-4">
          <StatusCard
            title="No pudimos unirte al workspace"
            description={
              accept.error?.message ??
              "Ocurrió un error al aceptar la invitación."
            }
          >
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  accept.reset();
                  void logout();
                  setMode("login");
                }}
              >
                Salir de esta cuenta
              </Button>
              <Link
                to="/"
                className="text-center text-sm text-primary underline-offset-4 hover:underline"
              >
                Ir a TaskMaster
              </Link>
            </div>
          </StatusCard>
        </div>
      );
    }
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-4">
        <StatusCard
          title={`Uniéndote a ${preview.workspaceName}…`}
          description={accept.isPending ? "Un momento…" : ""}
        />
      </div>
    );
  }

  const expiresLabel = new Intl.DateTimeFormat("es", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(preview.expiresAt));

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <InviteLogo />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Te invitaron a {preview.workspaceName}
            </CardTitle>
            <CardDescription>
              <strong>{preview.inviterName}</strong> te invitó a colaborar en
              este workspace. Para aceptar, iniciá sesión o creá una cuenta con
              tu email <strong>{preview.email}</strong>. La invitación vence el{" "}
              {expiresLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("login")}
              >
                Iniciar sesión
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("register")}
              >
                Crear cuenta
              </Button>
            </div>
            {mode === "login" ? (
              <LoginForm
                email={preview.email}
                onAuthenticated={async (email, password) => {
                  await login({ email, password });
                }}
              />
            ) : (
              <RegisterForm
                email={preview.email}
                onAuthenticated={async (name, email, password) => {
                  await register({ name, email, password });
                  await login({ email, password });
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
