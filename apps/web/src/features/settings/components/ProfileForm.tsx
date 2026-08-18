import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileSchema } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth.store";
import { useUpdateProfile } from "@/features/users/hooks/useProfile";

type FormValues = {
  name: string;
  avatarUrl: string;
};

export function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? "",
      avatarUrl: user?.avatarUrl ?? "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        avatarUrl: user.avatarUrl ?? "",
      });
    }
  }, [user, reset]);

  const avatarUrl = watch("avatarUrl");

  async function onSubmit(values: FormValues) {
    await updateProfile.mutateAsync({
      name: values.name,
      avatarUrl: values.avatarUrl || null,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar
          name={user?.name ?? "?"}
          src={avatarUrl || user?.avatarUrl}
          className="h-16 w-16 text-lg"
        />
        <div className="flex-1 space-y-1">
          <Label htmlFor="profile-name">Nombre</Label>
          <Input id="profile-name" autoComplete="name" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="profile-avatar">URL del avatar (opcional)</Label>
        <Input
          id="profile-avatar"
          placeholder="https://ejemplo.com/avatar.jpg"
          {...register("avatarUrl")}
        />
        {errors.avatarUrl && (
          <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={user?.email ?? ""} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">
          El email no se puede cambiar
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateProfile.isPending || !isDirty}>
          {updateProfile.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
