import { toast } from "sonner";

export function showInviteDevToast(
  defaultValue: string,
  inviteUrl: string,
): void {
  toast.success(defaultValue, {
    description: (
      <div className="flex flex-col gap-1">
        <span>
          El email no se envía sin <code>RESEND_API_KEY</code>. Copiá el link
          para invitar:
        </span>
        <code className="break-all text-xs">{inviteUrl}</code>
      </div>
    ),
  });
}
