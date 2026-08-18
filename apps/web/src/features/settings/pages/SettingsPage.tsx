import { Moon, Sun, Monitor, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useUiStore, type Theme } from "@/store/ui.store";
import { useNavigate } from "react-router-dom";
import { logout } from "@/features/auth/api/auth.api";
import { MemberManagement } from "@/features/workspace/components/MemberManagement";
import { WorkspaceManagement } from "@/features/workspace/components/WorkspaceManagement";
import { CustomFieldDefinitionManager } from "@/features/custom-fields/components/CustomFieldDefinitionManager";
import { ProfileForm } from "../components/ProfileForm";
import { ChangePasswordForm } from "../components/ChangePasswordForm";

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export function SettingsPage() {
  const { theme, setTheme } = useUiStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Ajustes" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tema</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <Button
              key={t.value}
              variant={theme === t.value ? "default" : "outline"}
              onClick={() => setTheme(t.value)}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Miembros del workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberManagement />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceManagement />
        </CardContent>
      </Card>

      <CustomFieldDefinitionManager />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
